import "server-only";

import type { CoordinatorQuery } from "@/lib/coordinator/filters";
import { buildIndicators, weeklyAttendance } from "@/lib/coordinator/indicators";
import { DEPARTURE_REASON_LABEL } from "@/lib/coordinator/labels";
import { COORDINATOR_THRESHOLDS } from "@/lib/coordinator/thresholds";
import type { DepartureReasonCode, EnrollmentSignalInput } from "@/lib/coordinator/types";
import { listCycles, resolveCycle } from "@/lib/coordenacao-access";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { prisma } from "@/lib/prisma";

function weekStart(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  const [year, month, dayText] = utc.toISOString().slice(0, 10).split("-");
  return `${dayText}/${month}/${year}`;
}

function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export async function loadCoordinatorSnapshot(query: CoordinatorQuery, options?: { includeDetail?: boolean }) {
  const [cycles, cycle] = await Promise.all([listCycles(), resolveCycle(query.cycleId)]);
  if (!cycle) {
    return { cycles: [], cycle: null, payload: null };
  }

  const groups = await prisma.classGroup.findMany({
    where: {
      cycleId: cycle.id,
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.classGroupId ? { id: query.classGroupId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.scope === "external" ? { isExternal: true } : {}),
      ...(query.scope === "internal" ? { isExternal: false } : {}),
    },
    select: {
      id: true,
      capacity: true,
      status: true,
      isExternal: true,
      startTime: true,
      daysOfWeek: true,
      location: true,
      courseId: true,
      course: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      classGroupTeachers: { select: { teacher: { select: { id: true, name: true } } } },
    },
  });

  const groupIds = groups.map((group) => group.id);
  const cyclesMeta = cycles.map((item) => ({
    id: item.id,
    label: `Ciclo ${item.cycle}/${item.year}`,
    current: item.isVisibleForEnrollments,
  }));
  const cycleMeta = { id: cycle.id, label: `Ciclo ${cycle.cycle}/${cycle.year}` };
  if (groupIds.length === 0) {
    return {
      cycles: cyclesMeta,
      cycle: cycleMeta,
      payload: emptyPayload(groups),
    };
  }

  const endOfToday = getEndOfTodayBrazil();
  const now = new Date();
  const [enrollments, sessions, lessonCounts] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classGroupId: { in: groupIds } },
      select: {
        id: true,
        status: true,
        isPreEnrollment: true,
        enrollmentConfirmedAt: true,
        studentId: true,
        classGroupId: true,
        student: { select: { id: true, name: true, userId: true } },
      },
    }),
    prisma.classSession.findMany({
      where: { classGroupId: { in: groupIds }, status: { not: "CANCELED" }, sessionDate: { lte: endOfToday } },
      select: { id: true, classGroupId: true, sessionDate: true },
      orderBy: { sessionDate: "asc" },
    }),
    prisma.courseLesson.findMany({
      where: { module: { courseId: { in: [...new Set(groups.map((group) => group.courseId))] } } },
      select: { id: true, module: { select: { courseId: true } } },
    }),
  ]);

  const enrollmentIds = enrollments.map((row) => row.id);
  const sessionIds = sessions.map((session) => session.id);
  const userIds = [...new Set(enrollments.map((row) => row.student.userId).filter((id): id is string => !!id))];

  const [attendance, progressCompleted, progressAccess, scores, exercises, departures, feedbacks, tickets] = await Promise.all([
    sessionIds.length === 0
      ? Promise.resolve([])
      : prisma.sessionAttendance.findMany({
          where: { classSessionId: { in: sessionIds }, enrollmentId: { in: enrollmentIds } },
          select: { enrollmentId: true, classSessionId: true, present: true },
        }),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.enrollmentLessonProgress.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: enrollmentIds }, completed: true },
          _count: { id: true },
        }),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.enrollmentLessonProgress.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: enrollmentIds } },
          _max: { lastAccessedAt: true },
        }),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.classGroupExamAttempt.findMany({
          where: { enrollmentId: { in: enrollmentIds }, status: "SUBMITTED", scorePercent: { not: null } },
          select: { enrollmentId: true, scorePercent: true, exam: { select: { kind: true, title: true } } },
        }),
    options?.includeDetail === false || enrollmentIds.length === 0
      ? Promise.resolve([] as { enrollmentId: string; correct: boolean; exercise: { lesson: { id: string; title: string } | null } }[])
      : prisma.enrollmentLessonExerciseAnswer.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: { enrollmentId: true, correct: true, exercise: { select: { lesson: { select: { id: true, title: true } } } } },
        }),
    enrollmentIds.length === 0
      ? Promise.resolve([])
      : prisma.enrollmentDeparture.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          orderBy: { recordedAt: "desc" },
          select: { enrollmentId: true, reason: true, note: true, recordedAt: true },
        }),
    userIds.length === 0
      ? Promise.resolve([])
      : prisma.platformExperienceFeedback.findMany({
          where: { userId: { in: userIds } },
          select: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
        }),
    userIds.length === 0
      ? Promise.resolve([])
      : prisma.supportTicket.groupBy({
          by: ["subject"],
          where: { userId: { in: userIds } },
          _count: { id: true },
        }),
  ]);

  const lessonsByCourse = new Map<string, number>();
  for (const lesson of lessonCounts) {
    lessonsByCourse.set(lesson.module.courseId, (lessonsByCourse.get(lesson.module.courseId) ?? 0) + 1);
  }
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const sessionsByGroup = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const list = sessionsByGroup.get(session.classGroupId) ?? [];
    list.push(session);
    sessionsByGroup.set(session.classGroupId, list);
  }
  const attendanceByEnrollment = new Map<string, Map<string, boolean>>();
  for (const mark of attendance) {
    const map = attendanceByEnrollment.get(mark.enrollmentId) ?? new Map<string, boolean>();
    map.set(mark.classSessionId, mark.present);
    attendanceByEnrollment.set(mark.enrollmentId, map);
  }
  const completedByEnrollment = new Map(progressCompleted.map((row) => [row.enrollmentId, row._count.id]));
  const accessByEnrollment = new Map(progressAccess.map((row) => [row.enrollmentId, row._max.lastAccessedAt]));
  const scoresByEnrollment = new Map<string, number[]>();
  const diagnostic: number[] = [];
  const finalScores: number[] = [];
  for (const attempt of scores) {
    if (attempt.scorePercent == null) continue;
    const list = scoresByEnrollment.get(attempt.enrollmentId) ?? [];
    list.push(attempt.scorePercent);
    scoresByEnrollment.set(attempt.enrollmentId, list);
    if (attempt.exam.kind === "DIAGNOSTIC") diagnostic.push(attempt.scorePercent);
    if (attempt.exam.kind === "FINAL") finalScores.push(attempt.scorePercent);
  }
  const latestDeparture = new Map<string, (typeof departures)[number]>();
  for (const departure of departures) {
    if (!latestDeparture.has(departure.enrollmentId)) latestDeparture.set(departure.enrollmentId, departure);
  }

  const signals: EnrollmentSignalInput[] = enrollments.map((enrollment) => {
    const group = groupById.get(enrollment.classGroupId);
    const held = sessionsByGroup.get(enrollment.classGroupId) ?? [];
    const marks = attendanceByEnrollment.get(enrollment.id) ?? new Map<string, boolean>();
    const presentCount = [...marks.values()].filter(Boolean).length;
    const consecutiveAbsences = countFromSessions(held, marks);
    const lessonTotal = group ? lessonsByCourse.get(group.courseId) ?? 0 : 0;
    const completedLessons = completedByEnrollment.get(enrollment.id) ?? 0;
    const scoreList = scoresByEnrollment.get(enrollment.id) ?? [];
    const reason = latestDeparture.get(enrollment.id)?.reason;
    return {
      id: enrollment.id,
      studentName: enrollment.student.name,
      status: enrollment.status,
      isPreEnrollment: enrollment.isPreEnrollment,
      confirmed: enrollment.enrollmentConfirmedAt != null || !enrollment.isPreEnrollment,
      heldSessions: held.length,
      presentCount,
      consecutiveAbsences,
      progressPercent: lessonTotal > 0 ? Math.round((completedLessons / lessonTotal) * 100) : null,
      lmsInactiveDays: daysSince(accessByEnrollment.get(enrollment.id) ?? null, now),
      scorePercent: scoreList.length > 0 ? Math.round(scoreList.reduce((sum, value) => sum + value, 0) / scoreList.length) : null,
      classClosed: group?.status === "ENCERRADA",
      recordedReason: (reason as DepartureReasonCode | undefined) ?? null,
    };
  });

  const report = buildIndicators(signals);
  const classifiedById = new Map(report.classified.map((row) => [row.id, row]));
  const capacity = groups.reduce((sum, group) => sum + group.capacity, 0);
  const occupied = enrollments.filter((row) => row.status === "ACTIVE" || row.status === "SUSPENDED").length;

  const weekMap = new Map<string, { present: number; marked: number }>();
  for (const mark of attendance) {
    const session = sessions.find((item) => item.id === mark.classSessionId);
    if (!session) continue;
    const key = weekStart(session.sessionDate);
    const current = weekMap.get(key) ?? { present: 0, marked: 0 };
    current.marked += 1;
    if (mark.present) current.present += 1;
    weekMap.set(key, current);
  }

  const classes = groups.map((group) => {
    const rows = signals.filter((signal) => enrollments.find((item) => item.id === signal.id)?.classGroupId === group.id);
    const summary = buildIndicators(rows);
    const withAttendance = summary.classified.filter((row) => row.attendancePercent != null);
    const progressKnown = rows.filter((row) => row.progressPercent != null);
    const scoresKnown = rows.filter((row) => row.scorePercent != null);
    return {
      id: group.id,
      course: group.course.name,
      teachers: [group.teacher.name, ...group.classGroupTeachers.map((link) => link.teacher.name)].filter(
        (name, index, list) => list.indexOf(name) === index,
      ),
      enrolled: rows.length,
      capacity: group.capacity,
      occupancy: group.capacity > 0 ? Math.round((rows.filter((row) => enrollments.find((item) => item.id === row.id && (item.status === "ACTIVE" || item.status === "SUSPENDED"))).length / group.capacity) * 100) : null,
      started: summary.counts.started,
      attendance: summary.indicators.attendanceRate,
      atRisk: summary.counts.atRisk,
      dropout: summary.indicators.dropoutRate,
      completion: summary.indicators.completionRate,
      progress: progressKnown.length
        ? Math.round(progressKnown.reduce((sum, row) => sum + (row.progressPercent ?? 0), 0) / progressKnown.length)
        : null,
      performance: scoresKnown.length
        ? Math.round(scoresKnown.reduce((sum, row) => sum + (row.scorePercent ?? 0), 0) / scoresKnown.length)
        : null,
      attention: summary.counts.started > 0 && summary.indicators.dropoutRate.available && (summary.indicators.dropoutRate.value ?? 0) >= COORDINATOR_THRESHOLDS.classDropoutAttentionShare * 100,
      unmarkedSessions: (sessionsByGroup.get(group.id) ?? []).filter((session) => !attendance.some((mark) => mark.classSessionId === session.id)).length,
      averageAttendanceKnown: withAttendance.length > 0,
    };
  });

  const reasonCounts = new Map<string, number>();
  for (const departure of latestDeparture.values()) {
    const classified = classifiedById.get(departure.enrollmentId);
    if (!classified || (classified.kind !== "DROPOUT" && classified.kind !== "EARLY_DROPOUT" && classified.kind !== "NO_SHOW" && classified.kind !== "TRANSFERRED" && classified.kind !== "CANCELLED_ADMIN")) {
      reasonCounts.set(departure.reason, (reasonCounts.get(departure.reason) ?? 0) + 1);
    } else {
      reasonCounts.set(departure.reason, (reasonCounts.get(departure.reason) ?? 0) + 1);
    }
  }

  const lessonErrors = new Map<string, { title: string; correct: number; total: number }>();
  let exerciseCorrect = 0;
  let exerciseTotal = 0;
  const enrollmentsWithExercise = new Set<string>();
  for (const answer of exercises) {
    exerciseTotal += 1;
    if (answer.correct) exerciseCorrect += 1;
    enrollmentsWithExercise.add(answer.enrollmentId);
    const lesson = answer.exercise.lesson;
    if (!lesson) continue;
    const current = lessonErrors.get(lesson.id) ?? { title: lesson.title, correct: 0, total: 0 };
    current.total += 1;
    if (answer.correct) current.correct += 1;
    lessonErrors.set(lesson.id, current);
  }

  const progressKnown = signals.filter((row) => row.progressPercent != null);
  const scoreKnown = signals.filter((row) => row.scorePercent != null);
  const teacherMap = new Map<string, { name: string; classes: number; students: number; attendance: number[]; retention: number[] }>();
  for (const group of classes) {
    const source = groups.find((item) => item.id === group.id);
    if (!source) continue;
    const current = teacherMap.get(source.teacher.id) ?? { name: source.teacher.name, classes: 0, students: 0, attendance: [], retention: [] };
    current.classes += 1;
    current.students += group.enrolled;
    if (group.attendance.available && group.attendance.value != null) current.attendance.push(group.attendance.value);
    if (group.dropout.available && group.dropout.value != null) current.retention.push(100 - group.dropout.value);
    teacherMap.set(source.teacher.id, current);
  }

  const learningAvailable = diagnostic.length > 0 && finalScores.length > 0;
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    cycles: cyclesMeta,
    cycle: cycleMeta,
    payload: {
      definitions: report.indicators,
      counts: report.counts,
      occupation: capacity > 0 ? { value: Math.round((occupied / capacity) * 100), available: true, definition: "Matrículas ativas ou suspensas divididas pela capacidade das turmas do filtro." } : { value: null, available: false, definition: "Não há capacidade cadastrada neste recorte." },
      occupied,
      capacity,
      funnel: report.funnel,
      retention: report.retention,
      risk: report.risk.slice(0, 40),
      weekly: weeklyAttendance([...weekMap.entries()].map(([week, value]) => ({ week, ...value }))),
      classes,
      reasons: [...reasonCounts.entries()]
        .map(([code, count]) => ({ code, label: DEPARTURE_REASON_LABEL[code as DepartureReasonCode] ?? code, count }))
        .sort((a, b) => b.count - a.count),
      reasonsAvailable: latestDeparture.size > 0,
      lessons: [...lessonErrors.values()]
        .map((lesson) => ({
          title: lesson.title,
          accuracy: lesson.total > 0 ? Math.round((lesson.correct / lesson.total) * 100) : null,
          answers: lesson.total,
        }))
        .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101)),
      performance: {
        progress: progressKnown.length
          ? { value: Math.round(progressKnown.reduce((sum, row) => sum + (row.progressPercent ?? 0), 0) / progressKnown.length), available: true }
          : { value: null, available: false },
        exerciseAccuracy: exerciseTotal > 0 ? { value: Math.round((exerciseCorrect / exerciseTotal) * 100), available: true } : { value: null, available: false },
        exercisesAnswered: exerciseTotal,
        studentsWithoutActivity: report.classified.filter((row) => row.inAcademicCohort && !enrollmentsWithExercise.has(row.id)).length,
        score: scoreKnown.length
          ? { value: Math.round(scoreKnown.reduce((sum, row) => sum + (row.scorePercent ?? 0), 0) / scoreKnown.length), available: true }
          : { value: null, available: false },
        inactiveContent: signals.filter((row) => (row.lmsInactiveDays ?? 0) >= COORDINATOR_THRESHOLDS.lmsInactiveDays || (row.progressPercent === 0 && row.lmsInactiveDays == null)).length,
      },
      learningGain: learningAvailable
        ? { available: true, initial: average(diagnostic), final: average(finalScores), gain: average(finalScores) - average(diagnostic) }
        : { available: false, initial: null, final: null, gain: null },
      teachers: [...teacherMap.entries()]
        .map(([id, teacher]) => ({
          id,
          name: teacher.name,
          classes: teacher.classes,
          students: teacher.students,
          attendance: teacher.attendance.length ? Math.round(teacher.attendance.reduce((sum, value) => sum + value, 0) / teacher.attendance.length) : null,
          retention: teacher.retention.length ? Math.round(teacher.retention.reduce((sum, value) => sum + value, 0) / teacher.retention.length) : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      experience: feedbacks.length
        ? {
            available: true,
            count: feedbacks.length,
            platform: average(feedbacks.map((item) => item.ratingPlatform)),
            lessons: average(feedbacks.map((item) => item.ratingLessons)),
            teacher: average(feedbacks.map((item) => item.ratingTeacher)),
          }
        : { available: false, count: 0, platform: null, lessons: null, teacher: null },
      tickets: tickets
        .map((ticket) => ({ subject: ticket.subject, count: ticket._count.id }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      filters: {
        courses: [...new Map(groups.map((group) => [group.course.id, group.course.name])).entries()].map(([id, name]) => ({ id, name })),
        teachers: [...new Map(groups.map((group) => [group.teacher.id, group.teacher.name])).entries()].map(([id, name]) => ({ id, name })),
        classGroups: groups.map((group) => ({ id: group.id, label: `${group.course.name} · ${group.teacher.name} · ${group.startTime}` })),
      },
    },
  };
}

function countFromSessions(
  held: { id: string; sessionDate: Date }[],
  marks: Map<string, boolean>,
): number {
  const ordered = [...held].sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());
  let count = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const present = marks.get(ordered[index].id);
    if (present == null) continue;
    if (present) break;
    count += 1;
  }
  return count;
}

function emptyPayload(groups: { course: { id: string; name: string }; teacher: { id: string; name: string }; id: string; startTime: string }[]) {
  const empty = buildIndicators([]);
  return {
    definitions: empty.indicators,
    counts: empty.counts,
    occupation: { value: null, available: false, definition: "Não há turmas neste recorte." },
    occupied: 0,
    capacity: 0,
    funnel: empty.funnel,
    retention: empty.retention,
    risk: [],
    weekly: [],
    classes: [],
    reasons: [],
    reasonsAvailable: false,
    lessons: [],
    performance: {
      progress: { value: null, available: false },
      exerciseAccuracy: { value: null, available: false },
      exercisesAnswered: 0,
      studentsWithoutActivity: 0,
      score: { value: null, available: false },
      inactiveContent: 0,
    },
    learningGain: { available: false, initial: null, final: null, gain: null },
    teachers: [],
    experience: { available: false, count: 0, platform: null, lessons: null, teacher: null },
    tickets: [],
    filters: {
      courses: groups.map((group) => ({ id: group.course.id, name: group.course.name })),
      teachers: groups.map((group) => ({ id: group.teacher.id, name: group.teacher.name })),
      classGroups: groups.map((group) => ({ id: group.id, label: `${group.course.name} · ${group.startTime}` })),
    },
  };
}

export async function loadCoordinatorHistory() {
  const cycles = await listCycles();
  const rows = [];
  for (const cycle of cycles.slice(0, 8)) {
    const snapshot = await loadCoordinatorSnapshot({ cycleId: cycle.id, courseId: null, classGroupId: null, teacherId: null, scope: "all" }, { includeDetail: false });
    const payload = snapshot.payload;
    rows.push({
      id: cycle.id,
      label: `Ciclo ${cycle.cycle}/${cycle.year}`,
      enrollments: payload?.counts.enrollments ?? 0,
      occupation: payload?.occupation.value ?? null,
      started: payload?.counts.started ?? 0,
      attendance: payload?.definitions.attendanceRate.value ?? null,
      dropout: payload?.definitions.dropoutRate.value ?? null,
      completion: payload?.definitions.completionRate.value ?? null,
      progress: payload?.performance.progress.value ?? null,
    });
  }
  return rows;
}
