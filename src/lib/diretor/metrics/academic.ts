import "server-only";

import { CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT } from "@/lib/enrollment-attendance-streak";
import { FORMULA_VERSION_1A } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import {
  assessSessionQuality,
  type SessionLike,
} from "@/lib/diretor/eligible-sessions";
import {
  aggregateOpportunityRates,
  computeOpportunityRates,
  countUnjustifiedStreakEligible,
  hasStarted,
  type AttendanceMarkRow,
} from "@/lib/diretor/metrics/attendance-formulas";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
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
      preEnrollments: number;
      confirmed: number;
      started: number;
      completedStarted: number | null;
      completionStartedRate: number | null;
      nonStartRateAmongConfirmed: number | null;
      cancelAfterStartUntyped: number;
    };
    attendance: ReturnType<typeof aggregateOpportunityRates>;
    suspensions: number;
    criticalAbsenceRisk: number;
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
          isPreEnrollment: true,
          enrolledAt: true,
          enrollmentConfirmedAt: true,
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
      `${sessionQuality.pastNotReleasedCount} sessão(ões) passadas ainda em SCHEDULED — excluídas dos cálculos.`,
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
  for (const g of classGroups) {
    occByCg.set(
      g.id,
      enrollments.filter(
        (e) => e.classGroupId === g.id && (e.status === "ACTIVE" || e.status === "SUSPENDED"),
      ).length,
    );
  }

  const preEnrollments = enrollments.filter((e) => e.isPreEnrollment).length;
  const confirmed = enrollments.filter((e) => !e.isPreEnrollment).length;
  const suspensions = enrollments.filter((e) => e.status === "SUSPENDED").length;

  const opportunityRows = [];
  let criticalAbsenceRisk = 0;
  let startedCount = 0;
  let cancelAfterStart = 0;
  let startedInClosed = 0;
  let completedStartedInClosed = 0;
  const servedStudents = new Set<string>();
  const closedCgIds = new Set(classGroups.filter((g) => g.status === "ENCERRADA").map((g) => g.id));

  for (const e of enrollments) {
    const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt };
    const attMap = attendanceByEnrollment.get(e.id) ?? new Map();
    opportunityRows.push(computeOpportunityRates(entry, sessions, attMap, scope.dataAsOf));
    const started = hasStarted(entry, sessions, attMap, scope.dataAsOf);
    if (started) {
      startedCount += 1;
      servedStudents.add(e.studentId);
      if (closedCgIds.has(e.classGroupId)) {
        startedInClosed += 1;
        if (e.status === "COMPLETED") completedStartedInClosed += 1;
      }
      if (e.status === "CANCELLED") cancelAfterStart += 1;
    }
    if (e.status === "ACTIVE" || e.status === "SUSPENDED") {
      const streak = countUnjustifiedStreakEligible(entry, sessions, attMap, scope.dataAsOf);
      if (streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT) criticalAbsenceRisk += 1;
    }
  }

  const attendanceAgg = aggregateOpportunityRates(opportunityRows);
  if (attendanceAgg.unmarkedCount > 0) {
    qualityNotes.push(
      `Chamada incompleta: ${attendanceAgg.unmarkedCount} oportunidade(s) sem lançamento; completude ${attendanceAgg.callCompletenessRate ?? 0}%.`,
    );
    quality.push({ domain: "academic", status: "partial", note: "Há oportunidades sem registro de presença/falta." });
  }

  const completionStartedRate =
    closedCgIds.size === 0 ? null : pctOrNull(completedStartedInClosed, startedInClosed);
  const nonStartAmongConfirmed =
    confirmed > 0
      ? pctOrNull(
          enrollments.filter(
            (e) =>
              !e.isPreEnrollment &&
              !hasStarted(
                {
                  id: e.id,
                  classGroupId: e.classGroupId,
                  enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt,
                },
                sessions,
                attendanceByEnrollment.get(e.id) ?? new Map(),
                scope.dataAsOf,
              ),
          ).length,
          confirmed,
        )
      : null;

  const byCourseMap = new Map<
    string,
    { courseId: string; courseName: string; capacity: number; occupied: number }
  >();
  for (const g of classGroups) {
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
  const hrefPrio = buildDirectorHref("/diretor/prioridades", filterQs);

  const kpis: MetricValueDto[] = [
    metricCard("acad.attrition.risk.critical_absences", criticalAbsenceRisk, { quality: "ok", href: hrefAcad }),
    metricCard("acad.attendance.present_rate", attendanceAgg.presentRate, {
      quality:
        attendanceAgg.quality === "unavailable"
          ? "unavailable"
          : attendanceAgg.quality === "partial" || sessionQuality.pastNotReleasedCount > 0
            ? "partial"
            : "ok",
      unavailableReason: attendanceAgg.presentRate == null ? "Sem oportunidades elegíveis (LIBERADA)" : null,
      href: hrefAcad,
    }),
    metricCard("ben.served_unique", servedStudents.size, { quality: "ok", href: hrefAcad }),
  ];
  if (completionStartedRate != null) {
    kpis.push(metricCard("acad.completion.started_rate", completionStartedRate, { quality: "ok", href: hrefAcad }));
  }

  const alerts: DerivedAlertDto[] = [];
  if (criticalAbsenceRisk > 0) {
    alerts.push({
      id: "critical-absences",
      ruleId: "acad.critical_absence_streak",
      ruleVersion: FORMULA_VERSION_1A,
      domain: "academic",
      severity: "critical",
      title: "Risco crítico por faltas",
      fact: `${criticalAbsenceRisk} matrícula(s) ACTIVE/SUSPENDED com streak ≥${CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT}.`,
      value: criticalAbsenceRisk,
      denominator: "matrículas vinculadas no recorte",
      period: scope.cycleLabel,
      impact: "Risco de perda de vaga / desligamento por frequência.",
      suggestedDecision: "Solicitar plano de recuperação de frequência à coordenação.",
      metricId: "acad.attrition.risk.critical_absences",
      href: hrefPrio,
      source: "regra streak canônica (sessões LIBERADA)",
      status: "não acompanhado pelo sistema",
      operationalOwner: "não acompanhado pelo sistema",
    });
  }
  if (suspensions > 0) {
    alerts.push({
      id: "suspensions",
      ruleId: "acad.suspensions",
      ruleVersion: FORMULA_VERSION_1A,
      domain: "academic",
      severity: "attention",
      title: "Matrículas suspensas",
      fact: `${suspensions} matrícula(s) SUSPENDED.`,
      value: suspensions,
      period: scope.cycleLabel,
      impact: "Interrupção temporária da frequência.",
      suggestedDecision: "Acompanhar retorno às aulas.",
      metricId: "acad.suspension.count",
      href: hrefAcad,
      source: "Enrollment.status",
      status: "não acompanhado pelo sistema",
    });
  }
  if (sessionQuality.pastNotReleasedCount > 0) {
    alerts.push({
      id: "sessions-quality",
      ruleId: "acad.sessions_not_released",
      ruleVersion: FORMULA_VERSION_1A,
      domain: "academic",
      severity: "attention",
      title: "Qualidade: sessões passadas não liberadas",
      fact: `${sessionQuality.pastNotReleasedCount} sessão(ões) SCHEDULED com data ≤ dataAsOf.`,
      value: sessionQuality.pastNotReleasedCount,
      period: scope.cycleLabel,
      impact: "Frequência subestimada ou qualidade parcial.",
      suggestedDecision: "Pedir liberação/lançamento de frequência.",
      href: hrefAcad,
      source: "ClassSession.status",
      status: "não acompanhado pelo sistema",
    });
  }
  if (cancelAfterStart > 0) {
    alerts.push({
      id: "cancel-after-start",
      ruleId: "acad.cancel_after_start_untyped",
      ruleVersion: FORMULA_VERSION_1A,
      domain: "academic",
      severity: "info",
      title: "Cancelamentos após o início — motivo não tipado",
      fact: `${cancelAfterStart} matrícula(s) CANCELLED com presença elegível.`,
      value: cancelAfterStart,
      period: scope.cycleLabel,
      impact: "Sinal de saída sem classificação de evasão.",
      suggestedDecision: "Tratar como sinal parcial até existir motivo estruturado.",
      metricId: "acad.cancel.after_start_untyped",
      href: hrefAcad,
      source: "Enrollment + presença",
      status: "não acompanhado pelo sistema",
    });
  }

  if (quality.length === 0) quality.push({ domain: "academic", status: "ok" });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: scope.dataAsOf.toISOString(),
      filters: { scope: scope.scope, cycleId: scope.cycleId, cycleLabel: scope.cycleLabel, ...filters },
      quality,
      formulaVersion: FORMULA_VERSION_1A,
      viewer,
    },
    kpis,
    academic: {
      funnel: {
        preEnrollments,
        confirmed,
        started: startedCount,
        completedStarted: closedCgIds.size === 0 ? null : completedStartedInClosed,
        completionStartedRate,
        nonStartRateAmongConfirmed: nonStartAmongConfirmed,
        cancelAfterStartUntyped: cancelAfterStart,
      },
      attendance: attendanceAgg,
      suspensions,
      criticalAbsenceRisk,
      servedUnique: servedStudents.size,
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
    ["academic", scope.scope, scope.cycleId, filters.courseId, filters.classGroupId, filters.poloId, viewer],
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
