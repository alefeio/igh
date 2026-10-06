import { classifyEnrollment } from "@/lib/coordinator/classify";
import { COORDINATOR_THRESHOLDS } from "@/lib/coordinator/thresholds";
import type {
  EnrollmentSignalInput,
  FunnelStep,
  Indicator,
  RetentionPoint,
  RiskStudent,
} from "@/lib/coordinator/types";

function rate(numerator: number, denominator: number, definition: string): Indicator {
  if (denominator <= 0) return { value: null, available: false, definition };
  return { value: Math.round((numerator / denominator) * 100), available: true, definition };
}

export function buildIndicators(rows: EnrollmentSignalInput[]) {
  const classified = rows.map(classifyEnrollment);
  const academic = classified.filter((row) => row.inAcademicCohort);
  const startedRows = academic.filter((row) => row.started);
  const occupying = rows.filter((row) => row.status === "ACTIVE" || row.status === "SUSPENDED");
  const withAttendance = academic.filter((row) => row.attendancePercent != null);
  const attendanceSum = withAttendance.reduce((sum, row) => sum + (row.attendancePercent ?? 0), 0);

  const noShow = academic.filter((row) => row.kind === "NO_SHOW").length;
  const early = academic.filter((row) => row.kind === "EARLY_DROPOUT").length;
  const dropout = academic.filter((row) => row.kind === "DROPOUT").length;
  const completed = academic.filter((row) => row.kind === "COMPLETED").length;
  const confirmed = academic.length;

  const attendanceRate: Indicator =
    withAttendance.length === 0
      ? {
          value: null,
          available: false,
          definition: "Média da frequência de quem já teve aula realizada. Sem chamada, o valor não é zero.",
        }
      : {
          value: Math.round(attendanceSum / withAttendance.length),
          available: true,
          definition: "Média da frequência individual (presenças / aulas já realizadas da turma).",
        };

  const reached = (mark: number) =>
    startedRows.filter((row) => (row.attendancePercent ?? 0) >= mark).length;

  const retention: RetentionPoint[] = [
    { mark: 0, label: "No início (já frequentaram)", count: startedRows.length },
    ...COORDINATOR_THRESHOLDS.retentionMarks.map((mark) => ({
      mark,
      label: mark === 100 ? "Conclusão" : `${mark}%`,
      count: mark === 100 ? completed : reached(mark),
    })),
  ];

  const funnel: FunnelStep[] = [
    { key: "pre", label: "Pré-matrícula", count: rows.filter((row) => row.isPreEnrollment).length },
    { key: "confirmed", label: "Matrícula confirmada", count: confirmed },
    { key: "started", label: "Veio à primeira aula", count: startedRows.length },
    { key: "active", label: "Continua na turma", count: occupying.length },
    { key: "quarter", label: "Chegou a 1/4 das aulas", count: reached(25) },
    { key: "half", label: "Chegou à metade das aulas", count: reached(50) },
    { key: "threeQuarters", label: "Chegou a 3/4 das aulas", count: reached(75) },
    { key: "completed", label: "Concluiu o curso", count: completed },
  ];

  const risk: RiskStudent[] = classified
    .filter((row) => row.riskLevel && row.riskReasons.length > 0)
    .map((row) => ({
      enrollmentId: row.id,
      studentName: row.studentName,
      level: row.riskLevel as RiskStudent["level"],
      reasons: row.riskReasons,
      attendancePercent: row.attendancePercent,
    }))
    .sort((a, b) => {
      const rank = { CRITICAL: 0, WARNING: 1, ATTENTION: 2 };
      return rank[a.level] - rank[b.level] || a.studentName.localeCompare(b.studentName, "pt-BR");
    });

  return {
    classified,
    counts: {
      enrollments: rows.length,
      academic: academic.length,
      started: startedRows.length,
      noShow,
      earlyDropout: early,
      dropout,
      completed,
      suspended: academic.filter((row) => row.kind === "SUSPENDED").length,
      preEnrollment: rows.filter((row) => row.isPreEnrollment && !row.confirmed).length,
      atRisk: risk.length,
    },
    indicators: {
      attendanceRate,
      startedRate: rate(startedRows.length, confirmed, "Quem compareceu ao menos uma vez, entre as matrículas confirmadas."),
      retentionRate: rate(startedRows.length - early - dropout, startedRows.length, "Quem começou e não saiu no começo nem depois de frequentar, entre os que compareceram."),
      completionRate: rate(completed, startedRows.length, "Matrículas concluídas divididas por quem compareceu ao menos uma vez. Pré-matrícula sem confirmação não entra."),
      dropoutRate: rate(early + dropout, startedRows.length, "Saiu no começo ou depois de frequentar, entre quem já tinha começado. Cancelamento sem aula realizada não entra."),
      noShowRate: rate(noShow, confirmed, "Confirmou e não compareceu a nenhuma aula já realizada, entre as matrículas confirmadas."),
    },
    funnel,
    retention,
    risk,
  };
}

export function weeklyAttendance(
  points: { week: string; present: number; marked: number }[],
): { week: string; percent: number | null }[] {
  return points.map((point) => ({
    week: point.week,
    percent: point.marked > 0 ? Math.round((point.present / point.marked) * 100) : null,
  }));
}
