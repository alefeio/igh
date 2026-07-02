import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { applyAttendanceSuspensionRules } from "@/lib/enrollment-attendance-suspension";
import { attendancePercent, markToDb, rowToMark, type AttendanceMark } from "@/lib/attendance-mark";
import { processEmailOutboxBatch } from "@/lib/email/outbox";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { ensureClassSessionsLiberatedForStudent } from "@/lib/student-lesson-liberation";

async function getTeacherClassGroup(userId: string, classGroupId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return null;
  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
    select: { id: true, status: true },
  });
  if (!cg) return null;
  return { teacher, classGroup: cg };
}

function formatSessionDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

/** Grade de frequência: alunos × aulas liberadas. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const access = await getTeacherClassGroup(user.id, classGroupId);
  if (!access) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  await ensureClassSessionsLiberatedForStudent(classGroupId, access.classGroup.status);

  const [enrollments, sessions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classGroupId, status: { in: ["ACTIVE", "SUSPENDED"] } },
      orderBy: { student: { name: "asc" } },
      select: {
        id: true,
        status: true,
        student: { select: { name: true } },
      },
    }),
    prisma.classSession.findMany({
      where: { classGroupId, status: "LIBERADA" },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        sessionDate: true,
        lesson: { select: { title: true } },
      },
    }),
  ]);

  const sessionIds = sessions.map((s) => s.id);
  const enrollmentIds = enrollments.map((e) => e.id);

  const attendances =
    sessionIds.length > 0 && enrollmentIds.length > 0
      ? await prisma.sessionAttendance.findMany({
          where: {
            classSessionId: { in: sessionIds },
            enrollmentId: { in: enrollmentIds },
          },
          select: { classSessionId: true, enrollmentId: true, present: true, absenceJustification: true },
        })
      : [];

  const markByKey = new Map<string, AttendanceMark | null>();
  for (const a of attendances) {
    markByKey.set(`${a.enrollmentId}:${a.classSessionId}`, rowToMark(a));
  }

  const rows = enrollments.map((e) => {
    const cells: Record<string, AttendanceMark | null> = {};
    let presentCount = 0;
    let recordedCount = 0;
    for (const s of sessions) {
      const mark = markByKey.get(`${e.id}:${s.id}`) ?? null;
      cells[s.id] = mark;
      if (mark) {
        recordedCount += 1;
        if (mark === "P") presentCount += 1;
      }
    }
    return {
      enrollmentId: e.id,
      studentName: e.student.name,
      enrollmentStatus: e.status,
      cells,
      presentCount,
      recordedCount,
      frequencyPercent: recordedCount > 0 ? attendancePercent(presentCount, recordedCount) : null,
    };
  });

  return jsonOk({
    sessions: sessions.map((s, index) => ({
      id: s.id,
      sessionDate: s.sessionDate,
      sessionDateLabel: formatSessionDate(s.sessionDate),
      lessonNumber: index + 1,
      lessonTitle: s.lesson?.title ?? null,
    })),
    rows,
  });
}

/** Atualiza uma ou mais células da grade. Body: { updates: { sessionId, enrollmentId, mark: "P"|"F"|"J" }[] } */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const access = await getTeacherClassGroup(user.id, classGroupId);
  if (!access) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const rawUpdates = Array.isArray(body?.updates) ? body.updates : [];
  const updates: { sessionId: string; enrollmentId: string; mark: AttendanceMark }[] = [];

  for (const u of rawUpdates) {
    if (!u || typeof u !== "object") continue;
    const o = u as Record<string, unknown>;
    if (typeof o.sessionId !== "string" || typeof o.enrollmentId !== "string") continue;
    if (o.mark !== "P" && o.mark !== "F" && o.mark !== "J") continue;
    updates.push({ sessionId: o.sessionId, enrollmentId: o.enrollmentId, mark: o.mark });
  }

  if (updates.length === 0) {
    return jsonErr("VALIDATION_ERROR", "Nenhuma atualização válida.", 400);
  }

  const sessionIds = [...new Set(updates.map((u) => u.sessionId))];
  const enrollmentIds = [...new Set(updates.map((u) => u.enrollmentId))];

  const [validSessions, validEnrollments] = await Promise.all([
    prisma.classSession.findMany({
      where: { id: { in: sessionIds }, classGroupId, status: "LIBERADA" },
      select: { id: true },
    }),
    prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds }, classGroupId, status: { in: ["ACTIVE", "SUSPENDED"] } },
      select: { id: true },
    }),
  ]);

  const validSessionSet = new Set(validSessions.map((s) => s.id));
  const validEnrollmentSet = new Set(validEnrollments.map((e) => e.id));
  const savedRows = updates.filter(
    (u) => validSessionSet.has(u.sessionId) && validEnrollmentSet.has(u.enrollmentId)
  );

  if (savedRows.length === 0) {
    return jsonErr("VALIDATION_ERROR", "Sessão ou matrícula inválida.", 400);
  }

  await prisma.$transaction(
    savedRows.map((u) => {
      const { present, absenceJustification } = markToDb(u.mark);
      return prisma.sessionAttendance.upsert({
        where: {
          classSessionId_enrollmentId: {
            classSessionId: u.sessionId,
            enrollmentId: u.enrollmentId,
          },
        },
        create: {
          classSessionId: u.sessionId,
          enrollmentId: u.enrollmentId,
          present,
          absenceJustification,
        },
        update: { present, absenceJustification },
      });
    })
  );

  const suspensionRows = savedRows.map((u) => {
    const { present, absenceJustification } = markToDb(u.mark);
    return {
      enrollmentId: u.enrollmentId,
      present,
      absenceJustification,
    };
  });

  const uniqueByEnrollment = new Map<string, (typeof suspensionRows)[number]>();
  for (const row of suspensionRows) {
    uniqueByEnrollment.set(row.enrollmentId, row);
  }

  const { suspendedIds, reactivatedIds } = await applyAttendanceSuspensionRules({
    classGroupId,
    rows: [...uniqueByEnrollment.values()],
    performedByUserId: user.id,
  });

  if (suspendedIds.length > 0) {
    await processEmailOutboxBatch(Math.min(25, suspendedIds.length));
  }

  return jsonOk({
    saved: savedRows.length,
    suspendedEnrollmentIds: suspendedIds,
    reactivatedEnrollmentIds: reactivatedIds,
  });
}
