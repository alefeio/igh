import "server-only";

import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import { occupiesCurrentSeat, isCurrentClassGroup } from "@/lib/diretor/metrics/enrollment-formulas";
import {
  occupancyPercent as occupancyPct,
  seatOfferAcceptRate,
  uniqueDemandStudentIds,
} from "@/lib/diretor/metrics/offer-formulas";
import { buildDirectorHref } from "@/lib/diretor/search-params";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import { prisma } from "@/lib/prisma";

export type OfferBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
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
    demandUniqueCount: number;
    byCourse: Array<{
      courseId: string;
      courseName: string;
      capacity: number;
      occupied: number;
      occupancyPercent: number | null;
      waitlist: number;
    }>;
    demandNote: string;
  };
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
};

export type OfferSummary = {
  occupancyPercent: number | null;
  waitlist: number;
  emptyClasses: number;
  below30: number;
  quality: ResponseMetaDto["quality"];
  qualityNotes: string[];
  alerts: DerivedAlertDto[];
};

async function loadOfferUncached(
  scope: ScopeResolution,
  filters: { courseId?: string; poloId?: string },
  viewer: "DIRECTOR" | "MASTER",
  lite = false,
): Promise<OfferBundle> {
  const filterQs = {
    scope: scope.scope,
    cycleId: scope.cycleId ?? undefined,
    courseId: filters.courseId,
    poloId: filters.poloId,
  };
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
        select: { studentId: true, classGroupId: true, status: true },
      })
    : [];

  const waitlist = cgIds.length
    ? await prisma.enrollmentWaitlist.groupBy({
        by: ["classGroupId"],
        where: { classGroupId: { in: cgIds }, status: "WAITING" },
        _count: { id: true },
      })
    : [];
  const waitlistByCg = new Map(waitlist.map((w) => [w.classGroupId, w._count.id]));

  const waitlistStudents =
    !lite && cgIds.length > 0
      ? await prisma.enrollmentWaitlist.findMany({
          where: { classGroupId: { in: cgIds }, status: "WAITING" },
          select: { studentId: true },
        })
      : [];

  const seatOffers =
    !lite && cgIds.length
      ? await prisma.waitlistSeatOffer.groupBy({
          by: ["status"],
          where: { classGroupId: { in: cgIds } },
          _count: { id: true },
        })
      : [];
  const seatOfferCounts = { pending: 0, accepted: 0, expired: 0, cancelled: 0 };
  for (const row of seatOffers) {
    if (row.status === "PENDING") seatOfferCounts.pending = row._count.id;
    else if (row.status === "ACCEPTED") seatOfferCounts.accepted = row._count.id;
    else if (row.status === "EXPIRED") seatOfferCounts.expired = row._count.id;
    else if (row.status === "CANCELLED") seatOfferCounts.cancelled = row._count.id;
  }
  const acceptRate = seatOfferAcceptRate(seatOfferCounts);

  let capacity = 0;
  let occupied = 0;
  let emptyClasses = 0;
  let below30 = 0;
  let ge80 = 0;
  let full = 0;
  const occByCg = new Map<string, number>();
  for (const g of classGroups) {
    if (!isCurrentClassGroup(g.status)) {
      occByCg.set(g.id, 0);
      continue;
    }
    const occ = enrollments.filter(
      (e) =>
        e.classGroupId === g.id &&
        occupiesCurrentSeat({ enrollmentStatus: e.status, classGroupStatus: g.status }),
    ).length;
    occByCg.set(g.id, occ);
    capacity += g.capacity;
    occupied += occ;
    const p = occupancyPct(occ, g.capacity);
    if (occ === 0) emptyClasses += 1;
    if (p != null && p < 30) below30 += 1;
    if (p != null && p >= 80) ge80 += 1;
    if (p != null && p >= 100) full += 1;
  }

  const demandUnique = uniqueDemandStudentIds({
    waitlistWaitingStudentIds: waitlistStudents.map((w) => w.studentId),
  });

  const byCourseMap = new Map<
    string,
    { courseId: string; courseName: string; capacity: number; occupied: number; waitlist: number }
  >();
  for (const g of classGroups) {
    if (!isCurrentClassGroup(g.status)) continue;
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
    occupancyPercent: occupancyPct(c.occupied, c.capacity),
  }));

  const terrMap = new Map<string, { name: string; capacity: number; occupied: number; turmas: number }>();
  for (const g of classGroups) {
    if (!isCurrentClassGroup(g.status)) continue;
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
    occupancyPercent: occupancyPct(t.occupied, t.capacity),
  }));

  const occupancyPercent = occupancyPct(occupied, capacity);
  const totalWaitlist = [...waitlistByCg.values()].reduce((a, b) => a + b, 0);
  const hrefOffer = buildDirectorHref("/diretor/oferta-territorios", filterQs);

  if (classGroups.length === 0) {
    quality.push({ domain: "offer", status: "unavailable", note: "Nenhuma turma no recorte." });
  } else {
    quality.push({ domain: "offer", status: "ok" });
  }

  const alerts: DerivedAlertDto[] = [];
  if (emptyClasses + below30 > 0) {
    alerts.push({
      id: "low-occupancy",
      ruleId: "offer.low_occupancy",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "offer",
      severity: "attention",
      title: "Ocupação crítica de turmas",
      fact: `${emptyClasses} sem inscritos e ${below30} abaixo de 30% de ocupação atual.`,
      value: emptyClasses + below30,
      denominator: "turmas do recorte",
      period: scope.cycleLabel,
      impact: "Vagas ociosas / baixa adesão da oferta.",
      suggestedDecision: "Concentrar divulgação ou reavaliar ofertas com baixa adesão.",
      metricId: "offer.low_occupancy.classes",
      href: hrefOffer,
      source: "ocupação atual (ACTIVE+SUSPENDED ÷ capacity)",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (totalWaitlist > 0 && occupancyPercent != null && occupancyPercent >= 100) {
    alerts.push({
      id: "high-waitlist",
      ruleId: "offer.waitlist_full",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "offer",
      severity: "attention",
      title: "Espera elevada com turmas cheias",
      fact: `${totalWaitlist} reserva(s) WAITING com ocupação atual ≥100%.`,
      value: totalWaitlist,
      period: scope.cycleLabel,
      impact: "Demanda sem vaga imediata.",
      suggestedDecision: "Avaliar abertura de turma ou ofertas de vaga.",
      metricId: "offer.waitlist.count",
      href: hrefOffer,
      source: "EnrollmentWaitlist WAITING",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  const kpis: MetricValueDto[] = [
    metricCard("offer.occupancy.current", occupancyPercent, {
      quality: occupancyPercent == null ? "unavailable" : "ok",
      unavailableReason: occupancyPercent == null ? "Sem capacidade no recorte" : null,
      href: hrefOffer,
    }),
    metricCard("offer.waitlist.count", totalWaitlist, { quality: "ok", href: hrefOffer }),
  ];

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
      demandUniqueCount: demandUnique.uniqueCount,
      byCourse,
      demandNote:
        "Quadrantes demanda × conclusão não são calculados neste endpoint: a conclusão de coortes encerradas pertence ao loader Acadêmico (frequência).",
    },
    alerts,
    qualityNotes,
  };
}

export async function loadOffer(
  scope: ScopeResolution,
  filters: { courseId?: string; poloId?: string },
  viewer: "DIRECTOR" | "MASTER",
): Promise<OfferBundle> {
  return cachedDirector(
    ["offer", scope.scope, scope.cycleId, filters.courseId, filters.poloId, viewer],
    () => loadOfferUncached(scope, filters, viewer),
  );
}

export async function summarizeOffer(
  scope: ScopeResolution,
  viewer: "DIRECTOR" | "MASTER",
): Promise<OfferSummary> {
  return cachedDirector(["offer-summary", scope.scope, scope.cycleId, viewer], async () => {
    const b = await loadOfferUncached(scope, {}, viewer, true);
    return {
      occupancyPercent: b.offer.occupancyPercent,
      waitlist: b.offer.waitlist,
      emptyClasses: b.offer.emptyClasses,
      below30: b.offer.below30,
      quality: b.meta.quality,
      qualityNotes: b.qualityNotes,
      alerts: b.alerts,
    };
  });
}
