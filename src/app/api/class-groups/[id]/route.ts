import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateClassGroupSchema } from "@/lib/validators/class-groups";
import { createAuditLog } from "@/lib/audit";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import {
  generateSessionsByWorkload,
  parseDateOnly,
  parseDurationHours,
  expandHolidaysToDateStrings,
} from "@/lib/schedule";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateClassGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.classGroup.findUnique({
    where: { id },
    include: {
      course: { select: { workloadHours: true } },
      sessions: { orderBy: { sessionDate: "asc" } },
    },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const courseIdForGen = parsed.data.courseId ?? existing.courseId;
  const courseForWorkload = await prisma.course.findUnique({
    where: { id: courseIdForGen },
    select: { id: true, workloadHours: true },
  });
  if (parsed.data.courseId && !courseForWorkload) {
    return jsonErr("INVALID_COURSE", "Curso inválido.", 400);
  }
  if (parsed.data.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: parsed.data.teacherId },
      select: { id: true, deletedAt: true },
    });
    if (!teacher || teacher.deletedAt)
      return jsonErr("INVALID_TEACHER", "Professor inválido.", 400);
  }

  const shouldRegenerate =
    parsed.data.startDate !== undefined ||
    parsed.data.daysOfWeek !== undefined ||
    parsed.data.startTime !== undefined ||
    parsed.data.endTime !== undefined ||
    parsed.data.courseId !== undefined;

  let updatedStartDate = existing.startDate;
  if (parsed.data.startDate) {
    try {
      updatedStartDate = parseDateOnly(parsed.data.startDate);
    } catch {
      return jsonErr("INVALID_START_DATE", "Data de início inválida.", 400);
    }
  }

  const daysForGeneration = parsed.data.daysOfWeek ?? existing.daysOfWeek;
  const startTimeForGeneration = parsed.data.startTime ?? existing.startTime;
  const endTimeForGeneration = parsed.data.endTime ?? existing.endTime;
  const workloadHours = courseForWorkload?.workloadHours ?? existing.course.workloadHours ?? 0;

  const effectiveLocation =
    parsed.data.location !== undefined
      ? (parsed.data.location && parsed.data.location.trim()) || null
      : (existing.location && existing.location.trim()) || null;
  const locationFilter =
    effectiveLocation === null
      ? { OR: [{ location: null }, { location: "" }] }
      : { location: effectiveLocation };

  const candidates = await prisma.classGroup.findMany({
    where: {
      courseId: courseIdForGen,
      startTime: startTimeForGeneration,
      endTime: endTimeForGeneration,
      daysOfWeek: { hasEvery: daysForGeneration },
      status: { in: ["PLANEJADA", "ABERTA"] },
      id: { not: id },
      ...locationFilter,
    },
    select: { id: true, daysOfWeek: true },
  });
  const duplicate = candidates.find(
    (c) => c.daysOfWeek.length === daysForGeneration.length
  );
  if (duplicate) {
    return jsonErr(
      "DUPLICATE_CLASS_GROUP",
      "Já existe outra turma ativa para este curso com o mesmo horário, dias da semana e local. Escolha outro horário, outros dias, outro local ou outro curso.",
      409,
    );
  }

  let result: { dates: Date[]; endDate: Date; totalHours: number; totalSessions: number } | null =
    null;

  if (shouldRegenerate && workloadHours > 0) {
    const rangeStart = updatedStartDate;
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 2);

    const holidays = await prisma.holiday.findMany({
      where: { isActive: true },
      select: { date: true, recurring: true },
    });
    const holidayDateStrings = expandHolidaysToDateStrings(holidays, rangeStart, rangeEnd);

    try {
      result = generateSessionsByWorkload({
        startDate: updatedStartDate,
        daysOfWeek: daysForGeneration,
        startTime: startTimeForGeneration,
        endTime: endTimeForGeneration,
        workloadHours,
        holidayDateStrings,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar sessões.";
      return jsonErr("SCHEDULE_ERROR", msg, 400);
    }
  }

  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const effectiveEndDate = result?.endDate ?? existing.endDate;
  const preventAutoCloseValue =
    parsed.data.status === "ENCERRADA"
      ? false
      : parsed.data.status === "EM_ANDAMENTO" && effectiveEndDate && effectiveEndDate < today
        ? true
        : undefined;

  const lessonIds = shouldRegenerate && result
    ? await getCourseLessonIdsInOrder(courseIdForGen)
    : [];

  const { updated, sessionsCount, endDate, totalHours } = await prisma.$transaction(async (tx) => {
    const computedEndDate = result?.endDate ?? existing.endDate ?? updatedStartDate;
    const dates = result?.dates ?? [];

    const updatedGroup = await tx.classGroup.update({
      where: { id },
      data: {
        courseId: parsed.data.courseId ?? undefined,
        teacherId: parsed.data.teacherId ?? undefined,
        daysOfWeek: parsed.data.daysOfWeek ?? undefined,
        startDate: parsed.data.startDate ? updatedStartDate : undefined,
        endDate: shouldRegenerate ? computedEndDate : undefined,
        startTime: parsed.data.startTime ?? undefined,
        endTime: parsed.data.endTime ?? undefined,
        capacity: parsed.data.capacity ?? undefined,
        status: parsed.data.status ?? undefined,
        location: parsed.data.location === "" ? null : (parsed.data.location ?? undefined),
        ...(preventAutoCloseValue !== undefined && { preventAutoClose: preventAutoCloseValue }),
      },
    });

    if (shouldRegenerate) {
      await tx.classSession.deleteMany({ where: { classGroupId: id } });

      if (dates.length > 0) {
        await tx.classSession.createMany({
          data: dates.map((d, i) => ({
            classGroupId: id,
            sessionDate: d,
            startTime: startTimeForGeneration,
            endTime: endTimeForGeneration,
            status: "SCHEDULED",
            lessonId: lessonIds[i] ?? null,
          })),
        });
      }
    }

    return {
      updated: updatedGroup,
      sessionsCount: shouldRegenerate ? dates.length : 0,
      endDate: computedEndDate,
      totalHours: result?.totalHours ?? 0,
    };
  });

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: id,
    action: "UPDATE_CLASSGROUP",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  if (shouldRegenerate && result) {
    await createAuditLog({
      entityType: "ClassGroup",
      entityId: id,
      action: "GENERATE_SESSIONS",
      diff: {
        classGroupId: id,
        startDate: updatedStartDate,
        endDate,
        daysOfWeek: daysForGeneration,
        count: sessionsCount,
        totalHours,
      },
      performedByUserId: user.id,
    });
  }

  const finalTotalSessions =
    sessionsCount > 0 ? sessionsCount : (existing.sessions?.length ?? 0);
  const finalTotalHours =
    totalHours > 0
      ? totalHours
      : (existing.sessions?.length ?? 0) *
        parseDurationHours(updated.startTime, updated.endTime);

  return jsonOk({
    classGroup: {
      ...updated,
      totalSessions: finalTotalSessions,
      totalHours: finalTotalHours,
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const existing = await prisma.classGroup.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  await prisma.$transaction([
    prisma.classSession.deleteMany({ where: { classGroupId: id } }),
    prisma.classGroup.delete({ where: { id } }),
  ]);

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: id,
    action: "DELETE",
    diff: { before: existing },
    performedByUserId: user.id,
  });

  return jsonOk({ deleted: true });
}
