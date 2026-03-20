import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createClassGroupSchema } from "@/lib/validators/class-groups";
import { createAuditLog } from "@/lib/audit";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import {
  generateSessionsByWorkload,
  parseDateOnly,
  parseDurationHours,
  expandHolidaysToDateStrings,
} from "@/lib/schedule";
import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";

export async function GET() {
  try {
    const user = await requireRole(["ADMIN", "MASTER", "TEACHER"]);

    await applyClassGroupAutomaticStatusUpdates();

    const isTeacher = user.role === "TEACHER";
    let teacherId: string | null = null;
    if (isTeacher) {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true },
      });
      teacherId = teacher?.id ?? null;
      if (!teacherId) {
        return jsonOk({ classGroups: [] });
      }
    }

    const classGroups = await prisma.classGroup.findMany({
      where: isTeacher && teacherId ? { teacherId } : undefined,
      orderBy: [{ startDate: "asc" }, { course: { name: "asc" } }, { startTime: "asc" }],
      include: {
        course: true,
        teacher: true,
        sessions: {
          orderBy: { sessionDate: "asc" },
        },
        enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    });

    const classGroupsWithTotals = classGroups.map((cg) => {
      const { enrollments, sessions, ...rest } = cg;
      let totalHours = 0;
      try {
        for (const s of sessions) {
          totalHours += parseDurationHours(s.startTime, s.endTime);
        }
      } catch {
        // ignore
      }
      return {
        ...rest,
        totalSessions: sessions.length,
        totalHours: Math.round(totalHours * 100) / 100,
        enrollmentsCount: enrollments.length,
      };
    });

    return jsonOk({ classGroups: classGroupsWithTotals });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar turmas.";
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}

export async function POST(request: Request) {
  const user = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createClassGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { courseId, teacherId, startDate, daysOfWeek, startTime, endTime, capacity, status, location } =
    parsed.data;

  const [course, teacher] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, workloadHours: true } }),
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true, deletedAt: true } }),
  ]);

  if (!course) return jsonErr("INVALID_COURSE", "Curso inválido.", 400);
  if (!teacher || teacher.deletedAt) return jsonErr("INVALID_TEACHER", "Professor inválido.", 400);

  const normalizedLocation = (location && location.trim()) || null;
  const locationFilter =
    normalizedLocation === null
      ? { OR: [{ location: null }, { location: "" }] }
      : { location: normalizedLocation };

  const candidates = await prisma.classGroup.findMany({
    where: {
      courseId,
      startTime,
      endTime,
      daysOfWeek: { hasEvery: daysOfWeek },
      status: { in: ["PLANEJADA", "ABERTA"] },
      ...locationFilter,
    },
    select: { id: true, daysOfWeek: true },
  });
  const existingSame = candidates.find(
    (c) => c.daysOfWeek.length === daysOfWeek.length
  );
  if (existingSame) {
    return jsonErr(
      "DUPLICATE_CLASS_GROUP",
      "Já existe uma turma ativa para este curso com o mesmo horário, dias da semana e local. Escolha outro horário, outros dias, outro local ou outro curso.",
      409,
    );
  }

  const workloadHours = course.workloadHours ?? 0;
  if (workloadHours <= 0) {
    return jsonErr(
      "WORKLOAD_REQUIRED",
      "O curso selecionado não tem carga horária. Edite o curso em Cursos e informe a carga horária (em horas) para poder criar a turma e gerar as aulas.",
      400,
    );
  }

  let startDateValue: Date;
  try {
    startDateValue = parseDateOnly(startDate);
  } catch {
    return jsonErr("INVALID_START_DATE", "Data de início inválida.", 400);
  }

  const rangeStart = startDateValue;
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 2);

  const holidays = await prisma.holiday.findMany({
    where: { isActive: true },
    select: { date: true, recurring: true },
  });
  const holidayDateStrings = expandHolidaysToDateStrings(holidays, rangeStart, rangeEnd);

  let result: { dates: Date[]; endDate: Date; totalHours: number; totalSessions: number };
  try {
    result = generateSessionsByWorkload({
      startDate: startDateValue,
      daysOfWeek,
      startTime,
      endTime,
      workloadHours,
      holidayDateStrings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar sessões.";
    return jsonErr("SCHEDULE_ERROR", msg, 400);
  }

  const { dates, endDate, totalHours, totalSessions } = result;

  const lessonIds = await getCourseLessonIdsInOrder(courseId);

  const { classGroup } = await prisma.$transaction(async (tx) => {
    const created = await tx.classGroup.create({
      data: {
        courseId,
        teacherId,
        daysOfWeek,
        startDate: startDateValue,
        endDate,
        startTime,
        endTime,
        capacity,
        status: status ?? "PLANEJADA",
        location: location || null,
      },
    });

    if (dates.length > 0) {
      await tx.classSession.createMany({
        data: dates.map((d, i) => ({
          classGroupId: created.id,
          sessionDate: d,
          startTime,
          endTime,
          status: "SCHEDULED",
          lessonId: lessonIds[i] ?? null,
        })),
      });
    }

    return { classGroup: created };
  });

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: classGroup.id,
    action: "CREATE_CLASSGROUP",
    diff: { after: classGroup },
    performedByUserId: user.id,
  });

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: classGroup.id,
    action: "GENERATE_SESSIONS",
    diff: {
      classGroupId: classGroup.id,
      startDate,
      endDate,
      daysOfWeek,
      count: totalSessions,
      totalHours,
    },
    performedByUserId: user.id,
  });

  return jsonOk(
    {
      classGroup: {
        ...classGroup,
        totalSessions,
        totalHours,
      },
    },
    { status: 201 },
  );
}
