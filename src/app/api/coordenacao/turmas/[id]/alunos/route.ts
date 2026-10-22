import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";
import { cancellationTimelineItem, formatHistoryTimelineLabel, sortTimeline } from "@/lib/enrollment-timeline";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { formatDaysOrderedPt } from "@/lib/turma-display";

type Ctx = { params: Promise<{ id: string }> };

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};

export async function GET(_request: Request, context: Ctx) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }

  const { id } = await context.params;
  const group = await prisma.classGroup.findUnique({
    where: { id },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      daysOfWeek: true,
      courseId: true,
      course: { select: { name: true } },
      teacher: { select: { name: true } },
      classGroupTeachers: { select: { teacher: { select: { name: true } } } },
      cycle: { select: { id: true, cycle: true, year: true } },
    },
  });
  if (!group) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const [enrollments, lessonTotal] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classGroupId: id },
      orderBy: [{ student: { name: "asc" } }],
      select: {
        id: true,
        status: true,
        student: { select: { name: true, phone: true } },
      },
    }),
    prisma.courseLesson.count({ where: { module: { courseId: group.courseId } } }),
  ]);

  const enrollmentIds = enrollments.map((row) => row.id);
  const [attendance, completedLessons, exerciseAnswers, historyEntries, cancellationAudits] = await Promise.all([
    getEnrollmentAttendanceSummaries(enrollmentIds),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.enrollmentLessonProgress.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: enrollmentIds }, completed: true },
          _count: { id: true },
        }),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.enrollmentLessonExerciseAnswer.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: enrollmentIds } },
          _count: { id: true },
        }),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.enrollmentHistoryEntry.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          orderBy: { createdAt: "asc" },
          select: { enrollmentId: true, kind: true, body: true, createdAt: true },
        }),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.auditLog.findMany({
          where: {
            entityType: "Enrollment",
            entityId: { in: enrollmentIds },
            action: { in: ["UPDATE", "AUTO_CANCEL_ATTENDANCE", "EMAIL_SENT"] },
          },
          orderBy: { createdAt: "asc" },
          select: { entityId: true, action: true, diffJson: true, createdAt: true },
        }),
  ]);

  const completedByEnrollment = new Map(completedLessons.map((row) => [row.enrollmentId, row._count.id]));
  const exercisesByEnrollment = new Map(exerciseAnswers.map((row) => [row.enrollmentId, row._count.id]));
  const historyByEnrollment = new Map<string, { kind: string; body: string; createdAt: Date }[]>();
  for (const entry of historyEntries) {
    const list = historyByEnrollment.get(entry.enrollmentId) ?? [];
    list.push(entry);
    historyByEnrollment.set(entry.enrollmentId, list);
  }
  const auditsByEnrollment = new Map<string, { action: string; diffJson: string; createdAt: Date }[]>();
  for (const entry of cancellationAudits) {
    const list = auditsByEnrollment.get(entry.entityId) ?? [];
    list.push(entry);
    auditsByEnrollment.set(entry.entityId, list);
  }
  const teachers = [group.teacher.name, ...group.classGroupTeachers.map((link) => link.teacher.name)].filter(
    (name, index, list) => list.indexOf(name) === index,
  );

  return jsonOk({
    classGroup: {
      id: group.id,
      courseName: group.course.name,
      teachers,
      schedule: [formatDaysOrderedPt(group.daysOfWeek), group.startTime && group.endTime ? `${group.startTime}–${group.endTime}` : group.startTime]
        .filter(Boolean)
        .join(" · "),
      cycleId: group.cycle.id,
      cycleLabel: `Ciclo ${group.cycle.cycle}/${group.cycle.year}`,
    },
    students: enrollments.map((row) => {
      const summary = attendance.get(row.id);
      const completed = completedByEnrollment.get(row.id) ?? 0;
      const participationPercent = lessonTotal > 0 ? Math.round((completed / lessonTotal) * 100) : null;
      const history = historyByEnrollment.get(row.id) ?? [];
      const cancellation = cancellationTimelineItem({
        status: row.status,
        historyKinds: history.map((entry) => entry.kind),
        audits: auditsByEnrollment.get(row.id) ?? [],
      });
      return {
        enrollmentId: row.id,
        name: row.student.name,
        phone: row.student.phone?.trim() || null,
        status: row.status,
        statusLabel: STATUS_LABEL[row.status] ?? row.status,
        attendancePresent: summary?.presentCount ?? 0,
        attendanceTotal: summary?.totalSessions ?? 0,
        attendancePercent: summary?.percent ?? null,
        unjustifiedAbsences: summary?.unjustifiedAbsenceCount ?? 0,
        justifiedAbsences: summary?.justifiedAbsenceCount ?? 0,
        participationPercent,
        lessonsCompleted: completed,
        lessonsTotal: lessonTotal,
        exercisesAnswered: exercisesByEnrollment.get(row.id) ?? 0,
        history: sortTimeline([
          ...history.map((entry) => ({
            at: entry.createdAt.toISOString(),
            label: formatHistoryTimelineLabel(entry.kind, entry.body),
          })),
          ...(cancellation ? [cancellation] : []),
        ]),
      };
    }),
  });
}
