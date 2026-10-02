import { classifyEnrollment } from "@/lib/coordinator/classify";
import type { DepartureReasonCode, EnrollmentSignalInput } from "@/lib/coordinator/types";

export type SheetSession = {
  date: string;
  present: boolean | null;
  justified: boolean;
};

export type StudentSheetInput = {
  signal: EnrollmentSignalInput;
  enrolledAt: string | null;
  confirmedAt: string | null;
  firstPresentAt: string | null;
  absences: number;
  justifiedAbsences: number;
  sessions: SheetSession[];
  lessonsTotal: number;
  lessonsCompleted: number;
  lessonsStarted: number;
  lastActivityAt: string | null;
  exercisesAnswered: number;
  exercisesCorrect: number;
  examsSubmitted: number;
  examsPending: number;
  departureReason: DepartureReasonCode | null;
  events: { at: string; label: string }[];
};

export function buildStudentSheet(input: StudentSheetInput) {
  const classified = classifyEnrollment(input.signal);
  const recent = input.sessions.slice(-4);
  const previous = input.sessions.slice(-8, -4);
  const percent = (rows: SheetSession[]) => {
    const marked = rows.filter((row) => row.present != null);
    if (marked.length === 0) return null;
    return Math.round((marked.filter((row) => row.present).length / marked.length) * 100);
  };
  const recentPercent = percent(recent);
  const previousPercent = percent(previous);
  return {
    identification: {
      name: input.signal.studentName,
      enrollmentId: input.signal.id,
      status: input.signal.status,
    },
    journey: {
      enrolledAt: input.enrolledAt,
      confirmedAt: input.confirmedAt,
      firstPresentAt: input.firstPresentAt,
      stage: classified.kind,
      departureReason: input.departureReason,
      transferHasDestination: false,
    },
    attendance: {
      present: input.signal.presentCount,
      absences: input.absences,
      justified: input.justifiedAbsences,
      percent: classified.attendancePercent,
      consecutiveAbsences: input.signal.consecutiveAbsences,
      recent: recent,
      trend:
        recentPercent == null || previousPercent == null
          ? null
          : { previous: previousPercent, recent: recentPercent, delta: recentPercent - previousPercent },
    },
    progress: {
      percent: input.signal.progressPercent,
      started: input.lessonsStarted,
      completed: input.lessonsCompleted,
      total: input.lessonsTotal,
      lastActivityAt: input.lastActivityAt,
      inactiveDays: input.signal.lmsInactiveDays,
    },
    performance: {
      exercisesAnswered: input.exercisesAnswered,
      accuracy:
        input.exercisesAnswered > 0 ? Math.round((input.exercisesCorrect / input.exercisesAnswered) * 100) : null,
      examsSubmitted: input.examsSubmitted,
      examsPending: input.examsPending,
      score: input.signal.scorePercent,
    },
    risk: {
      level: classified.riskLevel,
      reasons: classified.riskReasons,
    },
    timeline: [...input.events].sort((a, b) => a.at.localeCompare(b.at)),
    hasAcademicData: input.signal.heldSessions > 0 || input.lessonsTotal > 0 || input.examsSubmitted > 0,
  };
}
