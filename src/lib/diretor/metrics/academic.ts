import "server-only";

import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import {
  assessSessionQuality,
  type SessionLike,
} from "@/lib/diretor/eligible-sessions";
import {
  aggregateOpportunityRates,
  computeOpportunityRates,
  countServedUniqueStudents,
  countUnjustifiedStreakEligible,
  hasStarted,
  isExecutiveAttendanceReliable,
  INCOMPLETE_CALL_ALERT,
  presenceDependentQuality,
  shouldEmitExecutiveAttendanceAlerts,
  reconcileConfirmedNonStart,
  type AttendanceMarkRow,
} from "@/lib/diretor/metrics/attendance-formulas";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import {
  countAbsenceProgression,
  directorEnrollmentEntry,
  executivePresenceCount,
  isCurrentClassGroup,
  occupiesCurrentSeat,
  CANCELLATION_PERIOD_UNAVAILABLE_REASON,
  INFERRED_ABSENCE_CANCELLATION_COPY,
} from "@/lib/diretor/metrics/enrollment-formulas";
import { occupancyPercent as occupancyPct } from "@/lib/diretor/metrics/offer-formulas";
import { buildDirectorHref } from "@/lib/diretor/search-params";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import { prisma } from "@/lib/prisma";

function pctOrNull(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export type AcademicBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  academic: {
    funnel: {
      enrollmentsInCycle: number;
      occupyingSeats: number;
      uniquePeople: number;
      started: number;
      notStarted: number;
      notStartedRate: number | null;
      completedStarted: number | null;
      completionStartedRate: number | null;
      cancelledStock: number;
      cancelledKnownReason: number;
      cancelledUnknownReason: number;
      streakThree: number;
      cancelledInferredAfterFour: number;
      cancellationPeriodQuality: "unavailable";
      cancelAfterStartUntyped: number;
      nearSuspension: number;
      unprocessedFourAbsences: number;
      attendanceReliable?: boolean;
    };
    attendance: ReturnType<typeof aggregateOpportunityRates> & {
      executiveReliable: boolean;
      quality: "ok" | "partial" | "unavailable";
    };
    suspensions: number;
    nearSuspension: number;
    streakThree: number;
    criticalAbsenceRisk: number;
    cancelled: number;
    cancelledKnownReason: number;
    cancelledUnknownReason: number;
    cancelledInferredAfterFour: number;
    occupyingSeats: number;
    servedUnique: number;
    byCourse: Array<{
      courseId: string;
      courseName: string;
      capacity: number;
      occupied: number;
      occupancyPercent: number | null;
    }>;
  };
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
};

export type AcademicSummary = {
  servedUnique: number;
  completionStartedRate: number | null;
  criticalAbsenceRisk: number;
  qualityNotes: string[];
  quality: ResponseMetaDto["quality"];
  alerts: DerivedAlertDto[];
};

async function loadAcademicUncached(
  scope: ScopeResolution,
  filters: { courseId?: string; classGroupId?: string; poloId?: string },
  viewer: "DIRECTOR" | "MASTER",
): Promise<AcademicBundle> {
  const filterQs = {
    scope: scope.scope,
    cycleId: scope.cycleId ?? undefined,
    courseId: filters.courseId,
    classGroupId: filters.classGroupId,
    poloId: filters.poloId,
  };
  const qualityNotes: string[] = [];
  const quality: ResponseMetaDto["quality"] = [];

  if (scope.classGroupIds.length === 0) {
    quality.push({ domain: "academic", status: "unavailable", note: "Nenhuma turma no recorte." });
  }

  const classGroups = await prisma.classGroup.findMany({
    where: {
      id: filters.classGroupId ? filters.classGroupId : { in: scope.classGroupIds },
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(filters.poloId ? { poloLocation: { poloId: filters.poloId } } : {}),
    },
    select: {
      id: true,
      capacity: true,
      status: true,
      courseId: true,
      course: { select: { id: true, name: true } },
    },
  });
  const cgIds = classGroups.map((g) => g.id);

  const enrollments = cgIds.length
    ? await prisma.enrollment.findMany({
        where: { classGroupId: { in: cgIds } },
        select: {
          id: true,
          studentId: true,
          classGroupId: true,
          status: true,
          enrolledAt: true,
        },
      })
    : [];

  const sessionsRaw = cgIds.length
    ? await prisma.classSession.findMany({
        where: { classGroupId: { in: cgIds } },
        select: { id: true, classGroupId: true, status: true, sessionDate: true, startTime: true },
      })
    : [];
  const sessions: SessionLike[] = sessionsRaw.map((s) => ({
    id: s.id,
    classGroupId: s.classGroupId,
    status: s.status,
    sessionDate: s.sessionDate,
    startTime: s.startTime,
  }));

  const sessionQuality = assessSessionQuality(sessions, scope.dataAsOf);
  if (sessionQuality.pastNotReleasedCount > 0) {
    qualityNotes.push(
      `${sessionQuality.pastNotReleasedCount} sessão(ões) já ocorridas ainda não foram liberadas e ficam de fora da frequência.`,
    );
    quality.push({ domain: "academic", status: "partial", note: "Há sessões passadas não liberadas." });
  }

  const attendanceRows =
    enrollments.length && sessions.length
      ? await prisma.sessionAttendance.findMany({
          where: {
            enrollmentId: { in: enrollments.map((e) => e.id) },
            classSessionId: { in: sessions.map((s) => s.id) },
          },
          select: {
            enrollmentId: true,
            classSessionId: true,
            present: true,
            absenceJustification: true,
          },
        })
      : [];

  const attendanceByEnrollment = new Map<string, Map<string, AttendanceMarkRow>>();
  for (const row of attendanceRows) {
    let m = attendanceByEnrollment.get(row.enrollmentId);
    if (!m) {
      m = new Map();
      attendanceByEnrollment.set(row.enrollmentId, m);
    }
    m.set(row.classSessionId, {
      classSessionId: row.classSessionId,
      present: row.present,
      absenceJustification: row.absenceJustification,
    });
  }

  const occByCg = new Map<string, number>();
  const cgById = new Map(classGroups.map((g) => [g.id, g]));
  for (const g of classGroups) {
    occByCg.set(
      g.id,
      enrollments.filter(
        (e) =>
          e.classGroupId === g.id &&
          occupiesCurrentSeat({ enrollmentStatus: e.status, classGroupStatus: g.status }),
      ).length,
    );
  }

  const enrollmentsInCycle = enrollments.length;
  const occupyingSeats = enrollments.filter((e) => {
    const g = cgById.get(e.classGroupId);
    return g ? occupiesCurrentSeat({ enrollmentStatus: e.status, classGroupStatus: g.status }) : false;
  }).length;
  const uniquePeople = new Set(enrollments.map((e) => e.studentId)).size;

  const opportunityRows = [];
  let startedCount = 0;
  let cancelAfterStart = 0;
  let startedInClosed = 0;
  let completedStartedInClosed = 0;
  const closedCgIds = new Set(classGroups.filter((g) => g.status === "ENCERRADA").map((g) => g.id));
  const progressionRows: Array<{ status: string; streak: number }> = [];

  for (const e of enrollments) {
    const entry = directorEnrollmentEntry(e);
    const attMap = attendanceByEnrollment.get(e.id) ?? new Map();
    opportunityRows.push(computeOpportunityRates(entry, sessions, attMap, scope.dataAsOf));
    const started = hasStarted(entry, sessions, attMap, scope.dataAsOf);
    if (started) {
      startedCount += 1;
      if (closedCgIds.has(e.classGroupId)) {
        startedInClosed += 1;
        if (e.status === "COMPLETED") completedStartedInClosed += 1;
      }
      if (e.status === "CANCELLED") cancelAfterStart += 1;
    }
    const streak = countUnjustifiedStreakEligible(entry, sessions, attMap, scope.dataAsOf);
    progressionRows.push({ status: e.status, streak });
  }
  const prog = countAbsenceProgression(progressionRows);
  const suspensions = prog.suspendedNow;
  const nearSuspension = prog.streakTwo;
  const streakThree = prog.streakThree;
  const unprocessedFourAbsences = prog.unprocessedFour;
  const cancelled = prog.cancelledUnknownReason + prog.cancelledKnownReason;
  const criticalAbsenceRisk = streakThree;

  const servedUnique = countServedUniqueStudents(enrollments, sessions, attendanceByEnrollment, scope.dataAsOf);
  const { notStarted, rate: notStartedRate } = reconcileConfirmedNonStart(enrollmentsInCycle, startedCount);

  const attendanceAgg = aggregateOpportunityRates(opportunityRows);
  const attendanceReliable = isExecutiveAttendanceReliable(attendanceAgg.callCompletenessRate);
  if (!attendanceReliable && attendanceAgg.callCompletenessRate != null) {
    qualityNotes.push(`${attendanceAgg.callCompletenessRate}% das chamadas preenchidas.`);
    quality.push({
      domain: "academic",
      status: "partial",
      note: "A frequência ainda não tem cobertura suficiente de chamada para leitura executiva definitiva.",
    });
  } else if (attendanceAgg.unmarkedCount > 0) {
    qualityNotes.push(
      `${attendanceAgg.callCompletenessRate ?? 0}% das chamadas preenchidas; ausências sem lançamento permanecem desconhecidas.`,
    );
    quality.push({
      domain: "academic",
      status: "partial",
      note: "Há chamadas sem lançamento; essas oportunidades não são contadas como faltas.",
    });
  }

  const completionStartedRate =
    closedCgIds.size === 0 ? null : pctOrNull(completedStartedInClosed, startedInClosed);

  const byCourseMap = new Map<
    string,
    { courseId: string; courseName: string; capacity: number; occupied: number }
  >();
  for (const g of classGroups) {
    if (!isCurrentClassGroup(g.status)) continue;
    const cur = byCourseMap.get(g.courseId) ?? {
      courseId: g.courseId,
      courseName: g.course.name,
      capacity: 0,
      occupied: 0,
    };
    cur.capacity += g.capacity;
    cur.occupied += occByCg.get(g.id) ?? 0;
    byCourseMap.set(g.courseId, cur);
  }
  const byCourse = [...byCourseMap.values()].map((c) => ({
    ...c,
    occupancyPercent: occupancyPct(c.occupied, c.capacity),
  }));

  const hrefAcad = buildDirectorHref("/diretor/academico", filterQs);

  const pq = presenceDependentQuality(attendanceReliable);
  const completenessNote =
    attendanceAgg.callCompletenessRate != null ? `${attendanceAgg.callCompletenessRate}% das chamadas preenchidas` : null;

  const servedExec = executivePresenceCount(servedUnique, attendanceReliable);

  const kpis: MetricValueDto[] = [
    metricCard("acad.enroll.cycle", enrollmentsInCycle, {
      quality: "ok",
      href: hrefAcad,
      explanation: "Todos os registros do ciclo. Canceladas e concluídas entram no histórico, não na ocupação atual.",
    }),
    metricCard("acad.enroll.occupying", occupyingSeats, {
      quality: "ok",
      href: hrefAcad,
      explanation: "Ativas e suspensas em turmas vigentes. Canceladas e concluídas não ocupam vaga.",
    }),
    metricCard("acad.enroll.unique_people", uniquePeople, {
      quality: "ok",
      href: hrefAcad,
    }),
    metricCard("acad.suspension.count", suspensions, {
      quality: "ok",
      href: hrefAcad,
      explanation: "Estoque atual com status suspenso. A causa não está registrada de forma estruturada.",
    }),
    metricCard("acad.absence.near_suspension", attendanceReliable ? nearSuspension : null, {
      quality: attendanceReliable ? "ok" : "unavailable",
      unavailableReason: attendanceReliable ? null : "Chamadas incompletas — sequência de faltas não é leitura executiva.",
      href: hrefAcad,
      explanation: "Ativas com duas faltas consecutivas sem justificativa identificadas na chamada.",
    }),
    metricCard("acad.absence.streak_three", attendanceReliable ? streakThree : null, {
      quality: attendanceReliable ? "ok" : "unavailable",
      unavailableReason: attendanceReliable ? null : "Chamadas incompletas — sequência de faltas não é leitura executiva.",
      href: hrefAcad,
      explanation: "Três faltas consecutivas sem justificativa identificadas. Não afirma que o status suspenso tenha essa causa.",
    }),
    metricCard("acad.cancel.known_reason", 0, {
      quality: "unavailable",
      unavailableReason: "Motivo estruturado de cancelamento ainda não existe no cadastro.",
      href: hrefAcad,
    }),
    metricCard("acad.cancel.unknown_reason", prog.cancelledUnknownReason, {
      quality: "ok",
      href: hrefAcad,
      explanation: "Matrículas canceladas no recorte de turmas, sem motivo estruturado.",
    }),
    metricCard("acad.cancel.period", null, {
      quality: "unavailable",
      unavailableReason: CANCELLATION_PERIOD_UNAVAILABLE_REASON,
      href: hrefAcad,
    }),
    metricCard("acad.attrition.risk.critical_absences", attendanceReliable ? streakThree : null, {
      quality: attendanceReliable ? "ok" : "unavailable",
      unavailableReason: attendanceReliable ? null : "Chamadas incompletas.",
      href: hrefAcad,
      explanation: "Casos com três faltas consecutivas identificadas — distinto do estoque de suspensos.",
    }),
    metricCard("acad.attendance.present_rate", attendanceAgg.presentRate, {
      quality:
        attendanceAgg.presentRate == null || !attendanceReliable
          ? attendanceAgg.presentRate == null
            ? "unavailable"
            : "partial"
          : sessionQuality.pastNotReleasedCount > 0
            ? "partial"
            : "ok",
      unavailableReason: attendanceAgg.presentRate == null ? "Sem oportunidades de chamada no recorte" : null,
      href: hrefAcad,
      explanation: attendanceReliable
        ? "Percentual de presenças entre as oportunidades de chamada já ocorridas e liberadas."
        : `Frequência provisória. ${completenessNote ?? ""}. Não use para meta nem síntese conclusiva.`,
      percentage: attendanceAgg.presentRate,
    }),
    metricCard("ben.served_unique", servedExec.value, {
      quality: servedExec.quality,
      unavailableReason: servedExec.unavailableReason,
      href: hrefAcad,
      formattedValue:
        servedExec.value == null
          ? undefined
          : attendanceReliable
            ? undefined
            : `${servedUnique.toLocaleString("pt-BR")} alunos com presença registrada`,
      currentValue: servedExec.value,
      explanation: attendanceReliable
        ? "Pessoas distintas com pelo menos uma presença em aula no recorte."
        : servedExec.value == null
          ? servedExec.unavailableReason ?? undefined
          : `Ao menos ${servedUnique.toLocaleString("pt-BR")} alunos atendidos nos registros disponíveis. ${completenessNote ?? ""}`,
    }),
    metricCard("acad.attendance.justified_rate", attendanceAgg.justifiedRate, {
      quality: attendanceAgg.justifiedRate == null ? "unavailable" : pq,
      unavailableReason: attendanceAgg.justifiedRate == null ? "Sem oportunidades de chamada no recorte" : null,
      href: hrefAcad,
      percentage: attendanceAgg.justifiedRate,
      explanation: attendanceReliable
        ? "Faltas justificadas sobre as oportunidades de aula já liberadas."
        : `Leitura provisória. ${completenessNote ?? ""}.`,
    }),
    metricCard("acad.attendance.unjustified_rate", attendanceAgg.unjustifiedRate, {
      quality: attendanceAgg.unjustifiedRate == null ? "unavailable" : pq,
      unavailableReason: attendanceAgg.unjustifiedRate == null ? "Sem oportunidades de chamada no recorte" : null,
      href: hrefAcad,
      percentage: attendanceAgg.unjustifiedRate,
      explanation: attendanceReliable
        ? "Faltas sem justificativa sobre as oportunidades de aula já liberadas."
        : `Leitura provisória. ${completenessNote ?? ""}. Não use para comparação conclusiva.`,
    }),
  ];
  if (completionStartedRate != null) {
    kpis.push(
      metricCard("acad.completion.started_rate", completionStartedRate, {
        quality: pq,
        href: hrefAcad,
        percentage: completionStartedRate,
      }),
    );
  }

  const alerts: DerivedAlertDto[] = [];
  if (!shouldEmitExecutiveAttendanceAlerts(attendanceAgg.callCompletenessRate) && attendanceAgg.callCompletenessRate != null) {
    alerts.push({
      id: "call-completeness-quality",
      ruleId: "acad.call_completeness_quality",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "attention",
      title: INCOMPLETE_CALL_ALERT.title,
      fact: INCOMPLETE_CALL_ALERT.fact,
      value: attendanceAgg.callCompletenessRate,
      period: scope.cycleLabel,
      impact: "A frequência não deve ser lida como indicador institucional definitivo neste recorte.",
      suggestedDecision: INCOMPLETE_CALL_ALERT.suggestedDecision,
      href: hrefAcad,
      source: "completude das chamadas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (attendanceReliable && nearSuspension > 0) {
    alerts.push({
      id: "near-suspension",
      ruleId: "acad.near_suspension",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "attention",
      title: "Alunos próximos da suspensão",
      fact: `${nearSuspension} matrícula(s) ativa(s) com duas faltas consecutivas sem justificativa.`,
      value: nearSuspension,
      period: scope.cycleLabel,
      impact: "Próxima falta consecutiva sem justificativa leva à suspensão.",
      suggestedDecision: "Orientar a coordenação a realizar contato preventivo.",
      metricId: "acad.absence.near_suspension",
      href: hrefAcad,
      source: "frequência em aulas liberadas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (suspensions > 0) {
    alerts.push({
      id: "suspensions",
      ruleId: "acad.suspensions",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "critical",
      title: "Matrículas suspensas",
      fact: `${suspensions} matrícula(s) com status suspenso. A causa não está registrada de forma estruturada.`,
      value: suspensions,
      period: scope.cycleLabel,
      impact: "Estoque atual. Não afirma que a suspensão tenha sido causada por três faltas.",
      suggestedDecision:
        "Priorizar o acompanhamento operacional das matrículas suspensas antes da próxima aula.",
      metricId: "acad.suspension.count",
      href: hrefAcad,
      source: "cadastro de matrículas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (attendanceReliable && streakThree > 0) {
    alerts.push({
      id: "streak-three",
      ruleId: "acad.streak_three",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "critical",
      title: "Três faltas consecutivas identificadas",
      fact: `${streakThree} matrícula(s) com três faltas consecutivas sem justificativa na chamada.`,
      value: streakThree,
      period: scope.cycleLabel,
      impact: "Evidência de frequência, independente do status cadastral.",
      suggestedDecision:
        "Priorizar o acompanhamento antes da próxima aula, pois uma nova falta poderá cancelar a matrícula.",
      metricId: "acad.absence.streak_three",
      href: hrefAcad,
      source: "frequência em aulas liberadas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (attendanceReliable && unprocessedFourAbsences > 0) {
    alerts.push({
      id: "unprocessed-four-absences",
      ruleId: "acad.unprocessed_four_absences",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "attention",
      title: "Cancelamento ainda não processado",
      fact: `${unprocessedFourAbsences} matrícula(s) com quatro faltas consecutivas sem justificativa ainda não canceladas.`,
      value: unprocessedFourAbsences,
      period: scope.cycleLabel,
      impact: "Inconsistência de processamento ou de qualidade dos dados.",
      suggestedDecision: "Pedir à coordenação a conferência do processamento automático de frequência.",
      href: hrefAcad,
      source: "frequência e status da matrícula",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (sessionQuality.pastNotReleasedCount > 0) {
    alerts.push({
      id: "sessions-quality",
      ruleId: "acad.sessions_not_released",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "attention",
      title: "Qualidade: sessões passadas não liberadas",
      fact: `${sessionQuality.pastNotReleasedCount} sessão(ões) já ocorridas ainda não foram liberadas para frequência.`,
      value: sessionQuality.pastNotReleasedCount,
      period: scope.cycleLabel,
      impact: "Frequência subestimada ou qualidade parcial.",
      suggestedDecision: "Pedir liberação/lançamento de frequência.",
      href: hrefAcad,
      source: "agenda de aulas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (cancelled > 0) {
    alerts.push({
      id: "cancellations-stock",
      ruleId: "acad.cancellations_stock",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "info",
      title: "Matrículas canceladas no recorte",
      fact: `${prog.cancelledUnknownReason} cancelamento(s) sem motivo estruturado. ${CANCELLATION_PERIOD_UNAVAILABLE_REASON}`,
      value: cancelled,
      period: scope.cycleLabel,
      impact: "Estoque no recorte de turmas, não um fluxo datado do período.",
      suggestedDecision: "Acompanhar o estoque até existir histórico de status.",
      metricId: "acad.cancel.unknown_reason",
      href: hrefAcad,
      source: "cadastro de matrículas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (attendanceReliable && prog.cancelledInferredAfterFour > 0) {
    alerts.push({
      id: "cancellations-inferred-four",
      ruleId: "acad.cancellations_inferred_four",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "academic",
      severity: "info",
      title: "Cancelamento após sequência de faltas",
      fact: `${prog.cancelledInferredAfterFour} caso(s). ${INFERRED_ABSENCE_CANCELLATION_COPY}`,
      value: prog.cancelledInferredAfterFour,
      period: scope.cycleLabel,
      impact: "Inferência pela chamada; não é motivo estruturado.",
      suggestedDecision: "Não tratar como causa estruturada até o histórico da Fase 2A.",
      href: hrefAcad,
      source: "frequência e status da matrícula",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  if (quality.length === 0) quality.push({ domain: "academic", status: "ok" });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: scope.dataAsOf.toISOString(),
      filters: { scope: scope.scope, cycleId: scope.cycleId, cycleLabel: scope.cycleLabel, ...filters },
      quality,
      formulaVersion: FORMULA_VERSION_1C,
      viewer,
    },
    kpis,
    academic: {
      funnel: {
        enrollmentsInCycle,
        occupyingSeats,
        uniquePeople,
        started: startedCount,
        notStarted,
        notStartedRate,
        completedStarted: closedCgIds.size === 0 ? null : completedStartedInClosed,
        completionStartedRate,
        cancelledStock: cancelled,
        cancelledKnownReason: prog.cancelledKnownReason,
        cancelledUnknownReason: prog.cancelledUnknownReason,
        streakThree,
        cancelledInferredAfterFour: prog.cancelledInferredAfterFour,
        cancellationPeriodQuality: "unavailable",
        cancelAfterStartUntyped: cancelAfterStart,
        nearSuspension,
        unprocessedFourAbsences,
        attendanceReliable,
      },
      attendance: {
        ...attendanceAgg,
        executiveReliable: attendanceReliable,
        quality:
          attendanceAgg.presentRate == null
            ? "unavailable"
            : attendanceReliable
              ? "ok"
              : "partial",
      },
      suspensions,
      nearSuspension,
      streakThree,
      criticalAbsenceRisk,
      cancelled,
      cancelledKnownReason: prog.cancelledKnownReason,
      cancelledUnknownReason: prog.cancelledUnknownReason,
      cancelledInferredAfterFour: prog.cancelledInferredAfterFour,
      occupyingSeats,
      servedUnique,
      byCourse,
    },
    alerts,
    qualityNotes,
  };
}

export async function loadAcademic(
  scope: ScopeResolution,
  filters: { courseId?: string; classGroupId?: string; poloId?: string },
  viewer: "DIRECTOR" | "MASTER",
): Promise<AcademicBundle> {
  return cachedDirector(
    ["academic", scope.scope, scope.cycleId, filters.courseId, filters.classGroupId, filters.poloId, viewer, "v5"],
    () => loadAcademicUncached(scope, filters, viewer),
  );
}

export async function summarizeAcademic(
  scope: ScopeResolution,
  viewer: "DIRECTOR" | "MASTER",
): Promise<AcademicSummary> {
  const b = await loadAcademic(scope, {}, viewer);
  return {
    servedUnique: b.academic.servedUnique,
    completionStartedRate: b.academic.funnel.completionStartedRate,
    criticalAbsenceRisk: b.academic.criticalAbsenceRisk,
    qualityNotes: b.qualityNotes,
    quality: b.meta.quality,
    alerts: b.alerts,
  };
}
