import "server-only";

import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import {
  assessSessionQuality,
  type SessionLike,
} from "@/lib/diretor/eligible-sessions";
import { hasStarted } from "@/lib/diretor/metrics/attendance-formulas";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import {
  classifyNewVsRecurrent,
  computersProgress,
  lgpdCount,
  multiCourseStudentIds,
  peopleGoalComparable,
} from "@/lib/diretor/metrics/social-formulas";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { resolvePeriod, yearBounds } from "@/lib/diretor/period";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import { prisma } from "@/lib/prisma";

export type SocialFilters = { from?: string; to?: string; cycleId?: string; poloId?: string; courseId?: string };

export type SocialBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  disclaimerLongTerm: string;
  peopleGoalNote: string;
  reach: {
    confirmedUnique: number;
    servedUnique: number;
    newServed: number;
    recurrentServed: number;
    multiCourseServed: number;
    completersUnique: number;
    certificatesIssued: number;
    territories: Array<{ name: string; served: number | string }>;
  };
  donations: {
    computersDonated: number;
    computersTarget: number | null;
    computersProgressPct: number | null;
    donatarias: number;
    visits: number;
  };
  charts: {
    newVsRecurrent: Array<{ tipo: string; valor: number }>;
    computers: Array<{ label: string; valor: number }>;
    visitsByClass: Array<{ classification: string; count: number }>;
  };
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
};

async function loadSocialUncached(
  filters: SocialFilters,
  viewer: "DIRECTOR" | "MASTER",
  asOf = new Date(),
): Promise<SocialBundle> {
  const period = resolvePeriod({ from: filters.from, to: filters.to, asOf });
  const scope = await resolveDirectorScope({
    scope: filters.cycleId ? "cycle" : "current",
    cycleId: filters.cycleId,
    dataAsOf: asOf,
  });
  const qualityNotes: string[] = [];
  const quality: ResponseMetaDto["quality"] = [];

  const classGroups = await prisma.classGroup.findMany({
    where: {
      id: { in: scope.classGroupIds },
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(filters.poloId ? { poloLocation: { poloId: filters.poloId } } : {}),
    },
    select: {
      id: true,
      status: true,
      location: true,
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
          certificateIssuedAt: true,
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
  const q = assessSessionQuality(sessions, asOf);
  if (q.pastNotReleasedCount > 0) {
    quality.push({ domain: "social", status: "partial", note: "Sessões passadas não liberadas." });
  }

  const attendance =
    enrollments.length && sessions.length
      ? await prisma.sessionAttendance.findMany({
          where: {
            enrollmentId: { in: enrollments.map((e) => e.id) },
            present: true,
          },
          select: { enrollmentId: true, classSessionId: true },
        })
      : [];
  const attByEnr = new Map<string, Map<string, { classSessionId: string; present: boolean; absenceJustification: string | null }>>();
  for (const row of attendance) {
    let m = attByEnr.get(row.enrollmentId);
    if (!m) {
      m = new Map();
      attByEnr.set(row.enrollmentId, m);
    }
    m.set(row.classSessionId, { classSessionId: row.classSessionId, present: true, absenceJustification: null });
  }

  const confirmedUnique = new Set(enrollments.filter((e) => !e.isPreEnrollment).map((e) => e.studentId));
  const served = new Set<string>();
  const completers = new Set<string>();
  const terrServed = new Map<string, Set<string>>();
  const cgById = new Map(classGroups.map((g) => [g.id, g]));

  for (const e of enrollments) {
    const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrollmentConfirmedAt ?? e.enrolledAt };
    const attMap = attByEnr.get(e.id) ?? new Map();
    const periodSessions = sessions.filter((s) => {
      const t = s.sessionDate.getTime();
      return t >= period.from.getTime() && t <= period.to.getTime();
    });
    if (hasStarted(entry, periodSessions, attMap, asOf)) {
      served.add(e.studentId);
      const g = cgById.get(e.classGroupId);
      const name =
        g?.poloLocation?.polo?.name?.trim() ||
        g?.poloLocation?.name?.trim() ||
        g?.location?.trim() ||
        "Sem território";
      const set = terrServed.get(name) ?? new Set();
      set.add(e.studentId);
      terrServed.set(name, set);
    }
    if (e.status === "COMPLETED" && hasStarted(entry, sessions, attMap, asOf)) completers.add(e.studentId);
  }

  const previouslyServed = new Set<string>();
  if (served.size > 0) {
    const prior = await prisma.sessionAttendance.findMany({
      where: {
        present: true,
        enrollment: { studentId: { in: [...served] } },
        classSession: { status: "LIBERADA", sessionDate: { lt: period.from } },
      },
      select: { enrollment: { select: { studentId: true } } },
    });
    for (const row of prior) previouslyServed.add(row.enrollment.studentId);
  }
  const { newIds, recurrentIds } = classifyNewVsRecurrent({
    servedIds: [...served],
    previouslyServedIds: [...previouslyServed],
  });

  const courseByStudent = new Map<string, Set<string>>();
  for (const e of enrollments) {
    if (!served.has(e.studentId)) continue;
    const set = courseByStudent.get(e.studentId) ?? new Set();
    set.add(e.classGroupId);
    courseByStudent.set(e.studentId, set);
  }
  const multiCourseIds = multiCourseStudentIds(courseByStudent);

  const certificatesIssued = enrollments.filter(
    (e) => e.certificateIssuedAt && e.certificateIssuedAt >= period.from && e.certificateIssuedAt <= period.to,
  ).length;

  const year = period.from.getUTCFullYear();
  const yb = yearBounds(year);
  const donations = await prisma.donation.findMany({
    where: { deletedAt: null, status: "CONFIRMADA", donatedAt: { gte: yb.from, lte: yb.to } },
    select: { kitsCount: true, donatariaId: true },
  });
  const computersDonated = donations.reduce((a, d) => a + (d.kitsCount || 0), 0);
  const donatarias = new Set(donations.map((d) => d.donatariaId)).size;
  const goal = await prisma.annualGoal.findUnique({ where: { year } });
  const computersTarget = goal?.computersTarget ?? null;
  const progress = computersProgress(computersDonated, computersTarget ?? 0);

  const visits = await prisma.technicalVisit.findMany({
    where: { deletedAt: null, visitedAt: { gte: period.from, lte: period.to } },
    select: { finalClassification: true },
  });
  const visitMap = new Map<string, number>();
  for (const v of visits) {
    const k = v.finalClassification ?? "sem classificação";
    visitMap.set(k, (visitMap.get(k) ?? 0) + 1);
  }

  if (!peopleGoalComparable()) {
    qualityNotes.push(
      "A meta AnnualGoal.peopleTarget não está comprovadamente na mesma definição de “atendidos únicos”; percentual de execução não é calculado.",
    );
  }
  if (quality.length === 0) quality.push({ domain: "social", status: "ok" });

  const href = "/diretor/impacto-social";
  const kpis: MetricValueDto[] = [
    metricCard("soc.confirmed_unique", confirmedUnique.size, { quality: "ok", href }),
    metricCard("soc.served_unique", served.size, { quality: "ok", href }),
    metricCard("soc.computers_donated", computersDonated, { quality: computersTarget == null ? "partial" : "ok", href }),
  ];

  const alerts: DerivedAlertDto[] = [];
  if (computersTarget != null && computersTarget > 0 && computersDonated < computersTarget) {
    alerts.push({
      id: "soc-computers-goal",
      ruleId: "soc.computers_below_target",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "social",
      severity: "info",
      title: "Meta de computadores ainda não atingida",
      fact: `${computersDonated} doados no ano versus meta ${computersTarget}.`,
      value: computersDonated,
      denominator: String(computersTarget),
      period: String(year),
      impact: "Entrega de equipamentos abaixo da meta anual.",
      suggestedDecision: "Acompanhar doações restantes no ano.",
      href,
      source: "Donation.kitsCount × AnnualGoal.computersTarget",
      status: "não acompanhado pelo sistema",
    });
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: asOf.toISOString(),
      filters: { ...filters, cycleLabel: scope.cycleLabel, periodFrom: period.from.toISOString(), periodTo: period.to.toISOString() },
      quality,
      formulaVersion: FORMULA_VERSION_1C,
      viewer,
    },
    kpis,
    disclaimerLongTerm:
      "Resultados de longo prazo — emprego, renda e acompanhamento de egressos ainda não são coletados pelo sistema.",
    peopleGoalNote:
      "Meta de pessoas (AnnualGoal.peopleTarget) e atendidos únicos usam definições ainda não equivalentes. Exibidos separadamente, sem percentual de execução e sem alerta de atraso.",
    reach: {
      confirmedUnique: confirmedUnique.size,
      servedUnique: served.size,
      newServed: newIds.length,
      recurrentServed: recurrentIds.length,
      multiCourseServed: multiCourseIds.length,
      completersUnique: completers.size,
      certificatesIssued,
      territories: [...terrServed.entries()].map(([name, set]) => ({ name, served: lgpdCount(set.size) })),
    },
    donations: {
      computersDonated,
      computersTarget,
      computersProgressPct: progress,
      donatarias,
      visits: visits.length,
    },
    charts: {
      newVsRecurrent: [
        { tipo: "Novos", valor: newIds.length },
        { tipo: "Recorrentes", valor: recurrentIds.length },
      ],
      computers: [
        { label: "Doados", valor: computersDonated },
        { label: "Meta", valor: computersTarget ?? 0 },
      ],
      visitsByClass: [...visitMap.entries()].map(([classification, count]) => ({ classification, count })),
    },
    alerts,
    qualityNotes,
  };
}

export async function loadSocialImpact(filters: SocialFilters, viewer: "DIRECTOR" | "MASTER") {
  return cachedDirector(
    ["social", filters.from, filters.to, filters.cycleId, filters.poloId, filters.courseId, viewer],
    () => loadSocialUncached(filters, viewer),
  );
}

export async function summarizeSocial(filters: SocialFilters, viewer: "DIRECTOR" | "MASTER") {
  const b = await loadSocialImpact(filters, viewer);
  return {
    servedUnique: b.reach.servedUnique,
    computersDonated: b.donations.computersDonated,
    computersTarget: b.donations.computersTarget,
    computersProgressPct: b.donations.computersProgressPct,
    quality: b.meta.quality,
    qualityNotes: b.qualityNotes,
    alerts: b.alerts,
  };
}

/** Cards da home: equipamentos vs meta, sem recarregar frequência/listas temáticas. */
export async function summarizeSocialOverview(viewer: "DIRECTOR" | "MASTER", asOf = new Date()) {
  return cachedDirector(["social-overview", viewer], async () => {
    const year = asOf.getUTCFullYear();
    const yb = yearBounds(year);
    const donations = await prisma.donation.findMany({
      where: { deletedAt: null, status: "CONFIRMADA", donatedAt: { gte: yb.from, lte: yb.to } },
      select: { kitsCount: true },
    });
    const computersDonated = donations.reduce((a, d) => a + (d.kitsCount || 0), 0);
    const goal = await prisma.annualGoal.findUnique({ where: { year } });
    const computersTarget = goal?.computersTarget ?? null;
    const computersProgressPct = computersProgress(computersDonated, computersTarget ?? 0);
    const qualityNotes = peopleGoalComparable()
      ? []
      : [
          "A meta AnnualGoal.peopleTarget não está comprovadamente na mesma definição de “atendidos únicos”; percentual de execução não é calculado.",
        ];
    return {
      computersDonated,
      computersTarget,
      computersProgressPct,
      quality: [{ domain: "social", status: "ok" as const }],
      qualityNotes,
      alerts: [] as SocialBundle["alerts"],
    };
  });
}
