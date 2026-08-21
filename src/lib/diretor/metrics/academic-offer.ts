import "server-only";

import { CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT } from "@/lib/enrollment-attendance-streak";
import { FORMULA_VERSION_1A, getMetricDefinition } from "@/lib/diretor/catalog/definitions";
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
import { buildDirectorHref } from "@/lib/diretor/search-params";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import { prisma } from "@/lib/prisma";

function metricCard(
  metricId: string,
  value: number | string | null,
  opts: {
    quality: MetricValueDto["quality"];
    unavailableReason?: string | null;
    href?: string;
    labelOverride?: string;
  },
): MetricValueDto {
  const def = getMetricDefinition(metricId);
  return {
    metricId,
    label: opts.labelOverride ?? def?.name ?? metricId,
    value,
    unit: def?.unit,
    unavailableReason: opts.unavailableReason ?? null,
    quality: opts.quality,
    formulaVersion: def?.formulaVersion ?? FORMULA_VERSION_1A,
    formula: def?.formula ?? "",
    denominator: def?.denominator,
    href: opts.href,
  };
}

function pctOrNull(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export type AcademicOfferBundle = {
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
      waitlist: number;
    }>;
  };
  offer: {
    capacity: number;
    occupied: number;
    occupancyPercent: number | null;
    emptyClasses: number;
    below30: number;
    ge80: number;
    full: number;
    waitlist: number;
    seatOffers: {
      pending: number;
      accepted: number;
      expired: number;
      cancelled: number;
      acceptRate: number | null;
    };
    territories: Array<{
      name: string;
      capacity: number;
      occupied: number;
      occupancyPercent: number | null;
      turmas: number;
    }>;
    demandCompletionMatrix: Array<{
      courseId: string;
      courseName: string;
      demandProxy: number;
      completionStartedRate: number | null;
      quadrant: "expand" | "review_execution" | "review_marketing" | "reassess" | "unavailable";
    }>;
  };
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
};

export async function loadAcademicOfferBundle(
  scope: ScopeResolution,
  filters: {
    courseId?: string;
    classGroupId?: string;
    poloId?: string;
  },
  viewer: "DIRECTOR" | "MASTER",
): Promise<AcademicOfferBundle> {
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
    quality.push({
      domain: "academic",
      status: "unavailable",
      note: "Nenhuma turma no recorte.",
    });
  }

  const classGroups = await prisma.classGroup.findMany({
    where: {
      id: filters.classGroupId
        ? filters.classGroupId
        : { in: scope.classGroupIds },
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(filters.poloId ? { poloLocation: { poloId: filters.poloId } } : {}),
    },
    select: {
      id: true,
      capacity: true,
      status: true,
      location: true,
      courseId: true,
      course: { select: { id: true, name: true } },
      poloLocation: { select: { name: true, polo: { select: { name: true } } } },
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
        select: {
          id: true,
          classGroupId: true,
          status: true,
          sessionDate: true,
          startTime: true,
        },
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
      `${sessionQuality.pastNotReleasedCount} sessão(ões) com data já passada ainda em SCHEDULED (não liberadas) — excluídas dos cálculos e sinalizadas na qualidade dos dados.`,
    );
    quality.push({
      domain: "academic",
      status: "partial",
      note: "Há sessões passadas não liberadas.",
    });
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

  const waitlist = cgIds.length
    ? await prisma.enrollmentWaitlist.groupBy({
        by: ["classGroupId"],
        where: { classGroupId: { in: cgIds }, status: "WAITING" },
        _count: { id: true },
      })
    : [];
  const waitlistByCg = new Map(waitlist.map((w) => [w.classGroupId, w._count.id]));

  const seatOffers = cgIds.length
    ? await prisma.waitlistSeatOffer.groupBy({
        by: ["status"],
        where: { classGroupId: { in: cgIds } },
        _count: { id: true },
      })
    : [];
  const seatOfferCounts = {
    pending: 0,
    accepted: 0,
    expired: 0,
    cancelled: 0,
  };
  for (const row of seatOffers) {
    if (row.status === "PENDING") seatOfferCounts.pending = row._count.id;
    else if (row.status === "ACCEPTED") seatOfferCounts.accepted = row._count.id;
    else if (row.status === "EXPIRED") seatOfferCounts.expired = row._count.id;
    else if (row.status === "CANCELLED") seatOfferCounts.cancelled = row._count.id;
  }
  const seatDecided =
    seatOfferCounts.accepted + seatOfferCounts.expired + seatOfferCounts.cancelled;
  const acceptRate = pctOrNull(seatOfferCounts.accepted, seatDecided);

  let capacity = 0;
  let occupied = 0;
  let emptyClasses = 0;
  let below30 = 0;
  let ge80 = 0;
  let full = 0;

  const occByCg = new Map<string, number>();
  for (const g of classGroups) {
    const occ = enrollments.filter(
      (e) =>
        e.classGroupId === g.id && (e.status === "ACTIVE" || e.status === "SUSPENDED"),
    ).length;
    occByCg.set(g.id, occ);
    capacity += g.capacity;
    occupied += occ;
    const p = pctOrNull(occ, g.capacity);
    if (occ === 0) emptyClasses += 1;
    if (p != null && p < 30) below30 += 1;
    if (p != null && p >= 80) ge80 += 1;
    if (p != null && p >= 100) full += 1;
  }

  const preEnrollments = enrollments.filter((e) => e.isPreEnrollment).length;
  const confirmed = enrollments.filter((e) => !e.isPreEnrollment).length;
  const suspensions = enrollments.filter((e) => e.status === "SUSPENDED").length;

  const opportunityRows = [];
  let criticalAbsenceRisk = 0;
  let startedCount = 0;
  let completedStarted = 0;
  let cancelAfterStart = 0;
  let startedInClosed = 0;
  let completedStartedInClosed = 0;
  const servedStudents = new Set<string>();
  const closedCgIds = new Set(
    classGroups.filter((g) => g.status === "ENCERRADA").map((g) => g.id),
  );

  for (const e of enrollments) {
    const enteredAt = e.enrollmentConfirmedAt ?? e.enrolledAt;
    const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt };
    const attMap = attendanceByEnrollment.get(e.id) ?? new Map();
    const rates = computeOpportunityRates(entry, sessions, attMap, scope.dataAsOf);
    opportunityRows.push(rates);

    const started = hasStarted(entry, sessions, attMap, scope.dataAsOf);
    if (started) {
      startedCount += 1;
      servedStudents.add(e.studentId);
      if (closedCgIds.has(e.classGroupId)) {
        startedInClosed += 1;
        if (e.status === "COMPLETED") completedStartedInClosed += 1;
      }
      if (e.status === "COMPLETED") completedStarted += 1;
      if (e.status === "CANCELLED") cancelAfterStart += 1;
    }

    if (e.status === "ACTIVE" || e.status === "SUSPENDED") {
      const streak = countUnjustifiedStreakEligible(
        entry,
        sessions,
        attMap,
        scope.dataAsOf,
      );
      if (streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT) {
        criticalAbsenceRisk += 1;
      }
    }
  }

  const attendanceAgg = aggregateOpportunityRates(opportunityRows);
  const completionStartedRate =
    closedCgIds.size === 0
      ? null
      : pctOrNull(completedStartedInClosed, startedInClosed);
  const nonStartAmongConfirmed =
    confirmed > 0
      ? pctOrNull(
          enrollments.filter((e) => !e.isPreEnrollment && !hasStarted(
            {
              id: e.id,
              classGroupId: e.classGroupId,
              enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt,
            },
            sessions,
            attendanceByEnrollment.get(e.id) ?? new Map(),
            scope.dataAsOf,
          )).length,
          confirmed,
        )
      : null;

  // by course
  const byCourseMap = new Map<
    string,
    { courseId: string; courseName: string; capacity: number; occupied: number; waitlist: number }
  >();
  for (const g of classGroups) {
    const cur = byCourseMap.get(g.courseId) ?? {
      courseId: g.courseId,
      courseName: g.course.name,
      capacity: 0,
      occupied: 0,
      waitlist: 0,
    };
    cur.capacity += g.capacity;
    cur.occupied += occByCg.get(g.id) ?? 0;
    cur.waitlist += waitlistByCg.get(g.id) ?? 0;
    byCourseMap.set(g.courseId, cur);
  }
  const byCourse = [...byCourseMap.values()].map((c) => ({
    ...c,
    occupancyPercent: pctOrNull(c.occupied, c.capacity),
  }));

  // territories
  const terrMap = new Map<
    string,
    { name: string; capacity: number; occupied: number; turmas: number }
  >();
  for (const g of classGroups) {
    const name =
      g.poloLocation?.polo?.name?.trim() ||
      g.poloLocation?.name?.trim() ||
      g.location?.trim() ||
      "Sem território";
    const cur = terrMap.get(name) ?? { name, capacity: 0, occupied: 0, turmas: 0 };
    cur.capacity += g.capacity;
    cur.occupied += occByCg.get(g.id) ?? 0;
    cur.turmas += 1;
    terrMap.set(name, cur);
  }
  const territories = [...terrMap.values()].map((t) => ({
    ...t,
    occupancyPercent: pctOrNull(t.occupied, t.capacity),
  }));

  // demand × completion matrix — only closed cohorts
  const demandCompletionMatrix = byCourse
    .map((c) => {
      const closedForCourse = classGroups.filter(
        (g) => g.courseId === c.courseId && g.status === "ENCERRADA",
      );
      if (closedForCourse.length === 0) {
        return {
          courseId: c.courseId,
          courseName: c.courseName,
          demandProxy: c.waitlist + c.occupied,
          completionStartedRate: null as number | null,
          quadrant: "unavailable" as const,
        };
      }
      let started = 0;
      let completed = 0;
      for (const g of closedForCourse) {
        for (const e of enrollments.filter((x) => x.classGroupId === g.id)) {
          const entry = {
            id: e.id,
            classGroupId: e.classGroupId,
            enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt,
          };
          if (
            hasStarted(
              entry,
              sessions,
              attendanceByEnrollment.get(e.id) ?? new Map(),
              scope.dataAsOf,
            )
          ) {
            started += 1;
            if (e.status === "COMPLETED") completed += 1;
          }
        }
      }
      const completionStartedRate = pctOrNull(completed, started);
      const demandProxy = c.waitlist + c.occupied;
      const highDemand = demandProxy >= (c.capacity || 1) * 0.8 || c.waitlist > 0;
      const highCompletion =
        completionStartedRate != null && completionStartedRate >= 70;
      let quadrant: "expand" | "review_execution" | "review_marketing" | "reassess" | "unavailable" =
        "unavailable";
      if (completionStartedRate == null) quadrant = "unavailable";
      else if (highDemand && highCompletion) quadrant = "expand";
      else if (highDemand && !highCompletion) quadrant = "review_execution";
      else if (!highDemand && highCompletion) quadrant = "review_marketing";
      else quadrant = "reassess";
      return {
        courseId: c.courseId,
        courseName: c.courseName,
        demandProxy,
        completionStartedRate,
        quadrant,
      };
    })
    .filter((r) => r.quadrant !== "unavailable" || closedCgIds.size === 0);

  const occupancyPercent = pctOrNull(occupied, capacity);
  const totalWaitlist = [...waitlistByCg.values()].reduce((a, b) => a + b, 0);

  const hrefAcad = buildDirectorHref("/diretor/academico", filterQs);
  const hrefOffer = buildDirectorHref("/diretor/oferta-territorios", filterQs);
  const hrefPrio = buildDirectorHref("/diretor/prioridades", filterQs);

  const kpis: MetricValueDto[] = [
    metricCard("offer.occupancy.current", occupancyPercent, {
      quality: occupancyPercent == null ? "unavailable" : "ok",
      unavailableReason: occupancyPercent == null ? "Sem capacidade no recorte" : null,
      href: hrefOffer,
    }),
    metricCard("acad.attrition.risk.critical_absences", criticalAbsenceRisk, {
      quality: "ok",
      href: hrefAcad,
      labelOverride: "Risco crítico por faltas",
    }),
    metricCard("acad.attendance.present_rate", attendanceAgg.presentRate, {
      quality:
        sessionQuality.pastNotReleasedCount > 0
          ? "partial"
          : attendanceAgg.presentRate == null
            ? "unavailable"
            : "ok",
      unavailableReason:
        attendanceAgg.presentRate == null ? "Sem oportunidades elegíveis (LIBERADA)" : null,
      href: hrefAcad,
    }),
    metricCard("acad.pre_enroll.count", preEnrollments, {
      quality: "ok",
      href: hrefAcad,
    }),
    metricCard("offer.waitlist.count", totalWaitlist, {
      quality: "ok",
      href: hrefOffer,
    }),
  ];

  if (completionStartedRate != null) {
    kpis.push(
      metricCard("acad.completion.started_rate", completionStartedRate, {
        quality: "ok",
        href: hrefAcad,
      }),
    );
  }

  const alerts: DerivedAlertDto[] = [];
  if (criticalAbsenceRisk > 0) {
    alerts.push({
      id: "critical-absences",
      domain: "academic",
      severity: "critical",
      title: "Risco crítico por faltas",
      fact: `${criticalAbsenceRisk} matrícula(s) ACTIVE/SUSPENDED com streak ≥${CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT} faltas consecutivas sem justificativa.`,
      suggestedDecision: "Solicitar plano de recuperação de frequência à coordenação/professores.",
      metricId: "acad.attrition.risk.critical_absences",
      href: hrefPrio,
      source: "regra streak canônica (sessões LIBERADA)",
      status: "não acompanhado pelo sistema",
      operationalOwner: "não acompanhado pelo sistema",
    });
  }
  if (emptyClasses + below30 > 0) {
    alerts.push({
      id: "low-occupancy",
      domain: "offer",
      severity: "attention",
      title: "Ocupação crítica de turmas",
      fact: `${emptyClasses} sem inscritos e ${below30} abaixo de 30% de ocupação atual.`,
      suggestedDecision: "Concentrar divulgação ou reavaliar ofertas com baixa adesão.",
      metricId: "offer.low_occupancy.classes",
      href: hrefOffer,
      source: "ocupação atual",
      status: "não acompanhado pelo sistema",
    });
  }
  if (suspensions > 0) {
    alerts.push({
      id: "suspensions",
      domain: "academic",
      severity: "attention",
      title: "Matrículas suspensas",
      fact: `${suspensions} matrícula(s) com status SUSPENDED.`,
      suggestedDecision: "Acompanhar retorno às aulas presenciais.",
      metricId: "acad.suspension.count",
      href: hrefAcad,
      source: "Enrollment.status",
      status: "não acompanhado pelo sistema",
    });
  }
  if (sessionQuality.pastNotReleasedCount > 0) {
    alerts.push({
      id: "sessions-quality",
      domain: "academic",
      severity: "attention",
      title: "Qualidade: sessões passadas não liberadas",
      fact: `${sessionQuality.pastNotReleasedCount} sessão(ões) SCHEDULED com data ≤ dataAsOf.`,
      suggestedDecision: "Pedir liberação/lançamento de frequência às turmas afetadas.",
      href: hrefAcad,
      source: "ClassSession.status",
      status: "não acompanhado pelo sistema",
    });
  }
  if (cancelAfterStart > 0) {
    alerts.push({
      id: "cancel-after-start",
      domain: "academic",
      severity: "info",
      title: "Cancelamentos após o início — motivo não tipado",
      fact: `${cancelAfterStart} matrícula(s) CANCELLED com pelo menos uma presença elegível.`,
      suggestedDecision: "Tratar como sinal parcial até existir motivo estruturado de saída.",
      metricId: "acad.cancel.after_start_untyped",
      href: hrefAcad,
      source: "Enrollment + presença",
      status: "não acompanhado pelo sistema",
    });
  }

  if (quality.length === 0) {
    quality.push({ domain: "academic", status: "ok" });
    quality.push({ domain: "offer", status: "ok" });
  }

  const meta: ResponseMetaDto = {
    generatedAt: new Date().toISOString(),
    dataAsOf: scope.dataAsOf.toISOString(),
    filters: {
      scope: scope.scope,
      cycleId: scope.cycleId,
      cycleLabel: scope.cycleLabel,
      ...filters,
    },
    quality,
    formulaVersion: FORMULA_VERSION_1A,
    viewer,
  };

  return {
    meta,
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
    offer: {
      capacity,
      occupied,
      occupancyPercent,
      emptyClasses,
      below30,
      ge80,
      full,
      waitlist: totalWaitlist,
      seatOffers: { ...seatOfferCounts, acceptRate },
      territories,
      demandCompletionMatrix,
    },
    alerts,
    qualityNotes,
  };
}
