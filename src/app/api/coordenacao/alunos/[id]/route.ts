import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { buildStudentSheet } from "@/lib/coordinator/student-sheet";
import { observedAttendanceChange } from "@/lib/coordinator/intervention-window";
import { DEPARTURE_REASON_LABEL } from "@/lib/coordinator/labels";
import type { DepartureReasonCode } from "@/lib/coordinator/types";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
  const { id } = await context.params;
  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      isPreEnrollment: true,
      enrollmentConfirmedAt: true,
      enrolledAt: true,
      classGroupId: true,
      student: { select: { name: true, email: true, phone: true } },
      classGroup: {
        select: {
          id: true,
          status: true,
          startTime: true,
          courseId: true,
          course: { select: { name: true } },
          teacher: { select: { name: true } },
          classGroupTeachers: { select: { teacher: { select: { name: true } } } },
          cycle: { select: { cycle: true, year: true } },
        },
      },
      historyEntries: {
        orderBy: { createdAt: "asc" },
        take: 40,
        select: { id: true, kind: true, body: true, createdAt: true, author: { select: { name: true } } },
      },
      departures: {
        orderBy: { recordedAt: "asc" },
        select: { id: true, reason: true, note: true, recordedAt: true, recordedBy: { select: { name: true } } },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const now = new Date();
  const endOfToday = getEndOfTodayBrazil();
  const [sessions, progress, exercises, exams, lessonTotal, interventions] = await Promise.all([
    prisma.classSession.findMany({
      where: { classGroupId: enrollment.classGroupId, status: { not: "CANCELED" }, sessionDate: { lte: endOfToday } },
      orderBy: { sessionDate: "asc" },
      select: {
        id: true,
        sessionDate: true,
        sessionAttendances: {
          where: { enrollmentId: id },
          select: { present: true, absenceJustification: true },
        },
      },
    }),
    prisma.enrollmentLessonProgress.findMany({
      where: { enrollmentId: id },
      select: { completed: true, lastAccessedAt: true, percentWatched: true, percentRead: true },
    }),
    prisma.enrollmentLessonExerciseAnswer.findMany({
      where: { enrollmentId: id },
      select: { correct: true },
    }),
    prisma.classGroupExamAttempt.findMany({
      where: { enrollmentId: id },
      select: { status: true, scorePercent: true, exam: { select: { kind: true, status: true, title: true } } },
    }),
    prisma.courseLesson.count({ where: { module: { courseId: enrollment.classGroup.courseId } } }),
    prisma.coordinatorIntervention.findMany({
      where: { enrollmentId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        problem: true,
        action: true,
        status: true,
        resultNote: true,
        createdAt: true,
        dueAt: true,
        owner: { select: { name: true } },
      },
    }),
  ]);

  const sheetSessions = sessions.map((session) => {
    const mark = session.sessionAttendances[0];
    return {
      date: session.sessionDate.toISOString(),
      present: mark ? mark.present : null,
      justified: Boolean(mark && !mark.present && mark.absenceJustification),
    };
  });
  const presentCount = sheetSessions.filter((row) => row.present === true).length;
  const absences = sheetSessions.filter((row) => row.present === false).length;
  const justifiedAbsences = sheetSessions.filter((row) => row.justified).length;
  let consecutive = 0;
  for (let index = sheetSessions.length - 1; index >= 0; index -= 1) {
    if (sheetSessions[index].present == null) continue;
    if (sheetSessions[index].present) break;
    consecutive += 1;
  }
  const completedLessons = progress.filter((row) => row.completed).length;
  const startedLessons = progress.filter((row) => row.completed || row.percentWatched > 0 || row.percentRead > 0).length;
  const lastActivity = progress.reduce<Date | null>((latest, row) => {
    if (!row.lastAccessedAt) return latest;
    if (!latest || row.lastAccessedAt > latest) return row.lastAccessedAt;
    return latest;
  }, null);
  const submitted = exams.filter((row) => row.status === "SUBMITTED" && row.scorePercent != null);
  const score = submitted.length
    ? Math.round(submitted.reduce((sum, row) => sum + (row.scorePercent ?? 0), 0) / submitted.length)
    : null;
  const pending = exams.filter((row) => row.status === "IN_PROGRESS" || (row.exam.status === "PUBLISHED" && row.status !== "SUBMITTED")).length;
  const firstPresent = sheetSessions.find((row) => row.present === true)?.date ?? null;
  const latestDeparture = enrollment.departures.at(-1) ?? null;
  const inactiveDays = lastActivity ? Math.max(0, Math.floor((now.getTime() - lastActivity.getTime()) / 86_400_000)) : null;

  const sheet = buildStudentSheet({
    signal: {
      id: enrollment.id,
      studentName: enrollment.student.name,
      status: enrollment.status,
      isPreEnrollment: enrollment.isPreEnrollment,
      confirmed: enrollment.enrollmentConfirmedAt != null || !enrollment.isPreEnrollment,
      heldSessions: sessions.length,
      presentCount,
      consecutiveAbsences: consecutive,
      progressPercent: lessonTotal > 0 ? Math.round((completedLessons / lessonTotal) * 100) : null,
      lmsInactiveDays: inactiveDays,
      scorePercent: score,
      classClosed: enrollment.classGroup.status === "ENCERRADA",
      recordedReason: (latestDeparture?.reason as DepartureReasonCode | undefined) ?? null,
    },
    enrolledAt: enrollment.enrolledAt.toISOString(),
    confirmedAt: enrollment.enrollmentConfirmedAt?.toISOString() ?? null,
    firstPresentAt: firstPresent,
    absences,
    justifiedAbsences,
    sessions: sheetSessions,
    lessonsTotal: lessonTotal,
    lessonsCompleted: completedLessons,
    lessonsStarted: startedLessons,
    lastActivityAt: lastActivity?.toISOString() ?? null,
    exercisesAnswered: exercises.length,
    exercisesCorrect: exercises.filter((row) => row.correct).length,
    examsSubmitted: submitted.length,
    examsPending: pending,
    departureReason: (latestDeparture?.reason as DepartureReasonCode | undefined) ?? null,
    events: [
      { at: enrollment.enrolledAt.toISOString(), label: "Matrícula" },
      ...(enrollment.enrollmentConfirmedAt ? [{ at: enrollment.enrollmentConfirmedAt.toISOString(), label: "Confirmação" }] : []),
      ...(firstPresent ? [{ at: firstPresent, label: "Primeira presença" }] : []),
      ...enrollment.historyEntries.map((entry) => ({ at: entry.createdAt.toISOString(), label: `${entry.kind}: ${entry.body}` })),
      ...enrollment.departures.map((entry) => ({
        at: entry.recordedAt.toISOString(),
        label: `Saída registrada: ${DEPARTURE_REASON_LABEL[entry.reason]}`,
      })),
      ...interventions.map((entry) => ({ at: entry.createdAt.toISOString(), label: `Intervenção: ${entry.action}` })),
    ],
  });

  const marks = sheetSessions
    .filter((row) => row.present != null)
    .map((row) => ({ at: row.date, present: row.present === true }));

  return jsonOk({
    sheet,
    course: enrollment.classGroup.course.name,
    teachers: [enrollment.classGroup.teacher.name, ...enrollment.classGroup.classGroupTeachers.map((link) => link.teacher.name)],
    classTime: enrollment.classGroup.startTime,
    cycleLabel: `Ciclo ${enrollment.classGroup.cycle.cycle}/${enrollment.classGroup.cycle.year}`,
    contact: { phone: enrollment.student.phone, email: enrollment.student.email },
    departures: enrollment.departures,
    interventions: interventions.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      dueAt: item.dueAt?.toISOString() ?? null,
      observed: observedAttendanceChange(marks, item.createdAt.toISOString()),
    })),
    reasonLabels: DEPARTURE_REASON_LABEL,
  });
}
