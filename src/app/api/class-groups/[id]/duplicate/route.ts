import { prisma } from "@/lib/prisma";
import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import {
  generateSessionsByWorkload,
  parseDateOnly,
  parseDurationHours,
  splitHolidaysForSchedule,
} from "@/lib/schedule";

/** YYYY-MM-DD a partir do valor do Prisma (Date em runtime ou string ISO). */
function toDateOnlyString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const part = value.trim().split("T")[0]?.split(" ")[0] ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return null;
}

async function hasActiveDuplicateSlot(args: {
  courseId: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
  location: string | null;
}): Promise<boolean> {
  const normalizedLocation = (args.location && args.location.trim()) || null;
  const locationFilter =
    normalizedLocation === null
      ? { OR: [{ location: null }, { location: "" }] }
      : { location: normalizedLocation };

  const candidates = await prisma.classGroup.findMany({
    where: {
      courseId: args.courseId,
      startTime: args.startTime,
      endTime: args.endTime,
      daysOfWeek: { hasEvery: args.daysOfWeek },
      status: { in: ["PLANEJADA", "ABERTA"] },
      ...locationFilter,
    },
    select: { id: true, daysOfWeek: true },
  });
  return !!candidates.find((c) => c.daysOfWeek.length === args.daysOfWeek.length);
}

function nextCopyLocation(base: string | null, attempt: number): string {
  const b = (base ?? "").trim();
  if (b) {
    return attempt === 0 ? `${b} (cópia)` : `${b} (cópia ${attempt + 1})`;
  }
  return attempt === 0 ? "Cópia" : `Cópia ${attempt + 1}`;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStaffWrite();
    const { id: sourceId } = await context.params;

    const source = await prisma.classGroup.findUnique({
      where: { id: sourceId },
      include: {
        course: { select: { id: true, workloadHours: true } },
        teacher: { select: { id: true, deletedAt: true } },
      },
    });
    if (!source) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);
    if (!source.teacher || source.teacher.deletedAt) {
      return jsonErr("INVALID_TEACHER", "Professor inválido ou inativo.", 400);
    }

    const workloadHours = source.course.workloadHours ?? 0;
    if (workloadHours <= 0) {
      return jsonErr(
        "WORKLOAD_REQUIRED",
        "O curso desta turma não tem carga horária. Edite o curso e informe a carga horária antes de duplicar.",
        400,
      );
    }

    const startDateStr = toDateOnlyString(source.startDate);
    if (!startDateStr) {
      return jsonErr("INVALID_START_DATE", "Data de início da turma original inválida.", 400);
    }
    let startDateValue: Date;
    try {
      startDateValue = parseDateOnly(startDateStr);
    } catch {
      return jsonErr("INVALID_START_DATE", "Data de início da turma original inválida.", 400);
    }

    const rangeStart = startDateValue;
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 2);

    const holidays = await prisma.holiday.findMany({
      where: { isActive: true },
      select: { date: true, recurring: true, eventStartTime: true, eventEndTime: true },
    });
    const { holidayDateStrings, holidayEventBlocks } = splitHolidaysForSchedule(holidays, rangeStart, rangeEnd);

    let result: { dates: Date[]; endDate: Date; totalHours: number; totalSessions: number };
    try {
      result = generateSessionsByWorkload({
        startDate: startDateValue,
        daysOfWeek: source.daysOfWeek,
        startTime: source.startTime,
        endTime: source.endTime,
        workloadHours,
        holidayDateStrings,
        holidayEventBlocks,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar sessões.";
      return jsonErr("SCHEDULE_ERROR", msg, 400);
    }

    const { dates, endDate, totalHours, totalSessions } = result;
    const lessonIds = await getCourseLessonIdsInOrder(source.courseId);

    let chosenLocation: string | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const loc = nextCopyLocation(source.location, attempt);
      const normalized = loc.trim();
      chosenLocation = normalized.length > 0 ? normalized : null;
      const dup = await hasActiveDuplicateSlot({
        courseId: source.courseId,
        startTime: source.startTime,
        endTime: source.endTime,
        daysOfWeek: source.daysOfWeek,
        location: chosenLocation,
      });
      if (!dup) break;
      if (attempt === 39) {
        return jsonErr(
          "DUPLICATE_CLASS_GROUP",
          "Não foi possível criar uma cópia sem conflitar com outra turma planejada ou aberta. Ajuste a turma original e tente novamente.",
          409,
        );
      }
    }

    const { classGroup: created } = await prisma.$transaction(async (tx) => {
      const createdRow = await tx.classGroup.create({
        data: {
          courseId: source.courseId,
          teacherId: source.teacherId,
          daysOfWeek: source.daysOfWeek,
          startDate: startDateValue,
          endDate,
          startTime: source.startTime,
          endTime: source.endTime,
          capacity: source.capacity,
          status: "PLANEJADA",
          location: chosenLocation,
        },
      });

      if (dates.length > 0) {
        await tx.classSession.createMany({
          data: dates.map((d, i) => ({
            classGroupId: createdRow.id,
            sessionDate: d,
            startTime: source.startTime,
            endTime: source.endTime,
            status: "SCHEDULED",
            lessonId: lessonIds[i] ?? null,
          })),
        });
      }

      return { classGroup: createdRow };
    });

    await createAuditLog({
      entityType: "ClassGroup",
      entityId: created.id,
      action: "CREATE_CLASSGROUP",
      diff: { after: created, duplicatedFrom: sourceId },
      performedByUserId: user.id,
    });

    await createAuditLog({
      entityType: "ClassGroup",
      entityId: created.id,
      action: "GENERATE_SESSIONS",
      diff: {
        classGroupId: created.id,
        duplicatedFrom: sourceId,
        count: totalSessions,
        totalHours,
      },
      performedByUserId: user.id,
    });

    const full = await prisma.classGroup.findUnique({
      where: { id: created.id },
      include: {
        course: true,
        teacher: true,
        sessions: { orderBy: { sessionDate: "asc" } },
        enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    });
    if (!full) return jsonErr("INTERNAL_ERROR", "Turma criada mas não foi possível recarregar os dados.", 500);

    const { enrollments, sessions, ...rest } = full;
    let totalH = 0;
    try {
      for (const s of sessions) {
        totalH += parseDurationHours(s.startTime, s.endTime);
      }
    } catch {
      /* ignore */
    }

    return jsonOk(
      {
        classGroup: {
          ...rest,
          sessions,
          totalSessions: sessions.length,
          totalHours: Math.round(totalH * 100) / 100,
          enrollmentsCount: enrollments.length,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao duplicar turma.";
    if (message === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Sessão expirada ou não autenticado.", 401);
    if (message === "FORBIDDEN") return jsonErr("FORBIDDEN", "Sem permissão.", 403);
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}
