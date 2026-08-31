import "server-only";

import { randomUUID } from "node:crypto";
import type { z } from "zod";

import { createAuditLog } from "@/lib/audit";
import {
  bodyClassGroupScheduleChange,
  enrollmentSchedulePageUrl,
  titleScheduleChange,
} from "@/lib/class-schedule-notification-text";
import { applyClassGroupSessionSchedule } from "@/lib/class-group-session-resync";
import { syncClassGroupTeachers, validateTeacherIds } from "@/lib/class-group-teachers";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import {
  generateSessionsByWorkload,
  parseDateOnly,
  parseDurationHours,
  splitHolidaysForSchedule,
} from "@/lib/schedule";
import { createUserNotificationIfNew } from "@/lib/user-notifications";
import { revalidateMultiCertifiedStudentsCache } from "@/lib/student-multi-certification-cache";
import type { updateClassGroupSchema } from "@/lib/validators/class-groups";

export type ClassGroupPatch = z.infer<typeof updateClassGroupSchema>;

export type ApplyClassGroupUpdateResult =
  | {
      ok: true;
      sessionsRegenerated: boolean;
      classGroup: Record<string, unknown> & {
        id: string;
        totalSessions: number;
        totalHours: number;
      };
    }
  | { ok: false; code: string; message: string; status: number };

function normDays(d: string[]) {
  return [...d].sort().join(",");
}

export async function applyClassGroupUpdate(input: {
  id: string;
  data: ClassGroupPatch;
  performedByUserId: string;
  /** IDs já atualizados neste lote — evita falso duplicado intra-batch. */
  skipDuplicateIds?: string[];
}): Promise<ApplyClassGroupUpdateResult> {
  const { id, data, performedByUserId } = input;

  const existing = await prisma.classGroup.findUnique({
    where: { id },
    include: {
      course: { select: { workloadHours: true, name: true } },
      sessions: { orderBy: { sessionDate: "asc" } },
    },
  });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Turma não encontrada.", status: 404 };

  const courseIdForGen = data.courseId ?? existing.courseId;
  const courseForWorkload = await prisma.course.findUnique({
    where: { id: courseIdForGen },
    select: { id: true, workloadHours: true },
  });
  if (data.courseId && !courseForWorkload) {
    return { ok: false, code: "INVALID_COURSE", message: "Curso inválido.", status: 400 };
  }
  if (data.teacherIds) {
    const teacherValidation = await validateTeacherIds(data.teacherIds);
    if (!teacherValidation.ok) {
      return { ok: false, code: "INVALID_TEACHER", message: teacherValidation.message, status: 400 };
    }
  }

  let parsedStartDate: Date | null = null;
  if (data.startDate) {
    try {
      parsedStartDate = parseDateOnly(data.startDate);
    } catch {
      return { ok: false, code: "INVALID_START_DATE", message: "Data de início inválida.", status: 400 };
    }
  }

  const scheduleChanged =
    (parsedStartDate != null && parsedStartDate.getTime() !== existing.startDate.getTime()) ||
    (data.daysOfWeek !== undefined && normDays(data.daysOfWeek) !== normDays(existing.daysOfWeek)) ||
    (data.startTime !== undefined && data.startTime !== existing.startTime) ||
    (data.endTime !== undefined && data.endTime !== existing.endTime) ||
    (data.courseId !== undefined && data.courseId !== existing.courseId);

  const shouldRegenerate = scheduleChanged;

  if (data.cycleId) {
    const cycle = await prisma.cycle.findUnique({ where: { id: data.cycleId }, select: { id: true } });
    if (!cycle) return { ok: false, code: "INVALID_CYCLE", message: "Ciclo inválido.", status: 400 };
  }

  let updatedStartDate = existing.startDate;
  if (parsedStartDate) {
    updatedStartDate = parsedStartDate;
  }

  const daysForGeneration = data.daysOfWeek ?? existing.daysOfWeek;
  const startTimeForGeneration = data.startTime ?? existing.startTime;
  const endTimeForGeneration = data.endTime ?? existing.endTime;
  const workloadHours = courseForWorkload?.workloadHours ?? existing.course.workloadHours ?? 0;

  let resolvedPoloLocationId: string | null | undefined = undefined;
  let effectiveLocation =
    data.location !== undefined
      ? (data.location && data.location.trim()) || null
      : (existing.location && existing.location.trim()) || null;

  if (data.poloLocationId !== undefined) {
    if (!data.poloLocationId) {
      resolvedPoloLocationId = null;
    } else {
      const poloLoc = await prisma.poloLocation.findFirst({
        where: { id: data.poloLocationId, isActive: true, polo: { isActive: true } },
        select: { id: true, name: true },
      });
      if (!poloLoc) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Local do polo inválido.", status: 400 };
      }
      resolvedPoloLocationId = poloLoc.id;
      effectiveLocation = poloLoc.name;
    }
  }

  const locationFilter =
    effectiveLocation === null
      ? { OR: [{ location: null }, { location: "" }] }
      : { location: effectiveLocation };

  const skipIds = [id, ...(input.skipDuplicateIds ?? [])];
  const candidates = await prisma.classGroup.findMany({
    where: {
      courseId: courseIdForGen,
      startTime: startTimeForGeneration,
      endTime: endTimeForGeneration,
      daysOfWeek: { hasEvery: daysForGeneration },
      status: { in: ["PLANEJADA", "ABERTA"] },
      id: { notIn: skipIds },
      ...locationFilter,
    },
    select: { id: true, daysOfWeek: true },
  });
  const duplicate = candidates.find((c) => c.daysOfWeek.length === daysForGeneration.length);
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_CLASS_GROUP",
      message:
        "Já existe outra turma ativa para este curso com o mesmo horário, dias da semana e local. Escolha outro horário, outros dias, outro local ou outro curso.",
      status: 409,
    };
  }

  let result: { dates: Date[]; endDate: Date; totalHours: number; totalSessions: number } | null = null;

  if (shouldRegenerate && workloadHours > 0) {
    const rangeStart = updatedStartDate;
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 2);

    const holidays = await prisma.holiday.findMany({
      where: { isActive: true },
      select: { date: true, recurring: true, eventStartTime: true, eventEndTime: true },
    });
    const { holidayDateStrings, holidayEventBlocks } = splitHolidaysForSchedule(
      holidays,
      rangeStart,
      rangeEnd,
    );

    try {
      result = generateSessionsByWorkload({
        startDate: updatedStartDate,
        daysOfWeek: daysForGeneration,
        startTime: startTimeForGeneration,
        endTime: endTimeForGeneration,
        workloadHours,
        holidayDateStrings,
        holidayEventBlocks,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar sessões.";
      return { ok: false, code: "SCHEDULE_ERROR", message: msg, status: 400 };
    }
  }

  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const effectiveEndDate = result?.endDate ?? existing.endDate;
  const preventAutoCloseValue =
    data.status === "ENCERRADA"
      ? false
      : data.status === "EM_ANDAMENTO" && effectiveEndDate && effectiveEndDate < today
        ? true
        : undefined;

  const lessonIds = shouldRegenerate && result ? await getCourseLessonIdsInOrder(courseIdForGen) : [];

  const { updated, sessionsCount, endDate, totalHours } = await prisma.$transaction(async (tx) => {
    const computedEndDate = result?.endDate ?? existing.endDate ?? updatedStartDate;
    const dates = result?.dates ?? [];

    const updatedGroup = await tx.classGroup.update({
      where: { id },
      data: {
        cycleId: data.cycleId ?? undefined,
        courseId: data.courseId ?? undefined,
        teacherId: data.teacherIds?.[0] ?? undefined,
        daysOfWeek: data.daysOfWeek ?? undefined,
        startDate: data.startDate ? updatedStartDate : undefined,
        endDate: shouldRegenerate ? computedEndDate : undefined,
        startTime: data.startTime ?? undefined,
        endTime: data.endTime ?? undefined,
        capacity: data.capacity ?? undefined,
        status: data.status ?? undefined,
        isExternal: data.isExternal ?? undefined,
        location:
          data.poloLocationId !== undefined || data.location !== undefined ? effectiveLocation : undefined,
        ...(resolvedPoloLocationId !== undefined ? { poloLocationId: resolvedPoloLocationId } : {}),
        ...(preventAutoCloseValue !== undefined && { preventAutoClose: preventAutoCloseValue }),
      },
    });

    if (data.teacherIds) {
      await syncClassGroupTeachers(id, data.teacherIds, tx);
    }

    let syncedSessionsCount = 0;
    if (shouldRegenerate && result) {
      const sync = await applyClassGroupSessionSchedule(tx, {
        classGroupId: id,
        existingSessions: existing.sessions.map((s) => ({
          id: s.id,
          sessionDate: s.sessionDate,
          lessonId: s.lessonId,
          status: s.status,
        })),
        newDates: dates,
        lessonIds,
        startTime: startTimeForGeneration,
        endTime: endTimeForGeneration,
        endDate: computedEndDate,
      });
      syncedSessionsCount = sync.sessionsCount;
    }

    return {
      updated: updatedGroup,
      sessionsCount: shouldRegenerate ? syncedSessionsCount : 0,
      endDate: computedEndDate,
      totalHours: result?.totalHours ?? 0,
    };
  });

  const scheduleOrPlaceChanged =
    normDays(existing.daysOfWeek) !== normDays(updated.daysOfWeek) ||
    existing.startTime !== updated.startTime ||
    existing.endTime !== updated.endTime ||
    (existing.location ?? "").trim() !== (updated.location ?? "").trim() ||
    existing.startDate.getTime() !== updated.startDate.getTime() ||
    (existing.endDate?.getTime() ?? 0) !== (updated.endDate?.getTime() ?? 0);

  if (scheduleOrPlaceChanged) {
    const batchId = randomUUID();
    const enrollments = await prisma.enrollment.findMany({
      where: { classGroupId: id, status: "ACTIVE" },
      select: { id: true, student: { select: { userId: true } } },
    });
    const courseName =
      updated.courseId === existing.courseId
        ? existing.course.name
        : (
            await prisma.course.findUnique({
              where: { id: updated.courseId },
              select: { name: true },
            })
          )?.name;
    for (const e of enrollments) {
      if (!e.student.userId) continue;
      await createUserNotificationIfNew({
        userId: e.student.userId,
        kind: "CLASS_SCHEDULE_CHANGED",
        title: titleScheduleChange(courseName),
        body: bodyClassGroupScheduleChange(courseName),
        linkUrl: enrollmentSchedulePageUrl(e.id),
        dedupeKey: `class_change:${e.id}:${batchId}`,
      });
    }
  }

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: id,
    action: "UPDATE_CLASSGROUP",
    diff: { before: existing, after: updated },
    performedByUserId,
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
      performedByUserId,
    });
  }

  const finalTotalSessions = sessionsCount > 0 ? sessionsCount : (existing.sessions?.length ?? 0);
  const finalTotalHours =
    totalHours > 0
      ? totalHours
      : (existing.sessions?.length ?? 0) * parseDurationHours(updated.startTime, updated.endTime);

  if (existing.status !== "ENCERRADA" && updated.status === "ENCERRADA") {
    revalidateMultiCertifiedStudentsCache();
  }

  return {
    ok: true,
    sessionsRegenerated: Boolean(shouldRegenerate && result),
    classGroup: {
      ...updated,
      totalSessions: finalTotalSessions,
      totalHours: finalTotalHours,
    },
  };
}
