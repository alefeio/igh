import "server-only";

import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import { alertsFromExecutiveFacts, topPriorityAlerts } from "@/lib/diretor/alerts/engine";
import { mapSettledLimit } from "@/lib/diretor/concurrency";
import { loadAcademicExecutiveFacts } from "@/lib/diretor/facts/academic";
import { loadAdministrativeExecutiveFacts } from "@/lib/diretor/facts/administrative";
import { loadFinancialExecutiveFacts } from "@/lib/diretor/facts/financial";
import { loadOfferExecutiveFacts } from "@/lib/diretor/facts/offer";
import { loadProjectExecutiveFacts } from "@/lib/diretor/facts/projects";
import { loadSocialExecutiveFacts } from "@/lib/diretor/facts/social";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import { defaultCompetence } from "@/lib/diretor/period";
import type {
  AcademicExecutiveFacts,
  AdministrativeExecutiveFacts,
  FinancialExecutiveFacts,
  OfferExecutiveFacts,
  ProjectExecutiveFacts,
  SocialExecutiveFacts,
} from "@/lib/diretor/facts/types";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import { presenceDependentQuality, SOCIAL_PRESENCE_PARTIAL_NOTE } from "@/lib/diretor/metrics/attendance-formulas";
import { executivePresenceCount } from "@/lib/diretor/metrics/enrollment-formulas";
import { formatPtPercent } from "@/lib/diretor/reports/pdf-bars";
import { domainLabel } from "@/lib/diretor/ui-labels";
import { formatCentsBRL } from "@/lib/employees";

export type OverviewBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  alerts: DerivedAlertDto[];
  watchAlerts: DerivedAlertDto[];
  qualityNotes: string[];
  domainStatus: Array<{ domain: string; status: "ok" | "partial" | "unavailable"; note?: string }>;
  dataQuality: Array<{ title: string; fact: string; domain: string }>;
};

export async function loadOverviewSummaries(opts: {
  scope: ScopeResolution;
  viewer: "DIRECTOR" | "MASTER";
  execCompetence?: string;
}): Promise<OverviewBundle> {
  const competence = opts.execCompetence ?? defaultCompetence(opts.scope.dataAsOf);
  const asOf = opts.scope.dataAsOf;
  const settled = await mapSettledLimit(
    [
      { label: "academic", run: () => loadAcademicExecutiveFacts(opts.scope, opts.viewer) },
      { label: "offer", run: () => loadOfferExecutiveFacts(opts.scope, opts.viewer) },
      { label: "financial", run: () => loadFinancialExecutiveFacts({ competence }, opts.viewer, asOf) },
      { label: "social", run: () => loadSocialExecutiveFacts(opts.viewer, asOf) },
      { label: "administrative", run: () => loadAdministrativeExecutiveFacts(opts.viewer, asOf) },
      { label: "projects", run: () => loadProjectExecutiveFacts(opts.viewer) },
    ],
    2,
  );

  const by = Object.fromEntries(settled.map((s) => [s.label, s]));
  const qualityNotes: string[] = [];
  const domainStatus: OverviewBundle["domainStatus"] = [];
  const kpis: MetricValueDto[] = [];

  function take(name: string) {
    const r = by[name];
    if (!r || !r.ok) {
      domainStatus.push({
        domain: name,
        status: "unavailable",
        note: r && !r.ok ? r.error : `Não foi possível calcular ${domainLabel(name)}.`,
      });
      qualityNotes.push(r && !r.ok ? r.error : `Não foi possível calcular ${domainLabel(name)}.`);
      return;
    }
    const v = r.value as { quality: ResponseMetaDto["quality"]; qualityNotes?: string[] };
    domainStatus.push(...v.quality.map((q) => ({ domain: q.domain, status: q.status, note: q.note })));
    qualityNotes.push(...(v.qualityNotes ?? []));
  }

  for (const n of ["academic", "offer", "financial", "social", "administrative", "projects"]) take(n);

  const acad = by.academic?.ok ? (by.academic.value as AcademicExecutiveFacts) : undefined;
  const offer = by.offer?.ok ? (by.offer.value as OfferExecutiveFacts) : undefined;
  const fin = by.financial?.ok ? (by.financial.value as FinancialExecutiveFacts) : undefined;
  const social = by.social?.ok ? (by.social.value as SocialExecutiveFacts) : undefined;
  const admin = by.administrative?.ok ? (by.administrative.value as AdministrativeExecutiveFacts) : undefined;
  const projects = by.projects?.ok ? (by.projects.value as ProjectExecutiveFacts) : undefined;

  if (acad && !acad.attendanceReliable) {
    const socialPartial = {
      domain: "social",
      status: "partial" as const,
      note: SOCIAL_PRESENCE_PARTIAL_NOTE,
    };
    const idx = domainStatus.findIndex((d) => d.domain === "social");
    if (idx >= 0) domainStatus[idx] = socialPartial;
    else domainStatus.push(socialPartial);
    if (!qualityNotes.includes(SOCIAL_PRESENCE_PARTIAL_NOTE)) qualityNotes.push(SOCIAL_PRESENCE_PARTIAL_NOTE);
  }

  if (acad) {
    const pq = presenceDependentQuality(acad.attendanceReliable);
    const servedExec = executivePresenceCount(acad.servedUnique, acad.attendanceReliable);
    kpis.push(
      metricCard("acad.enroll.cycle", acad.enrollmentsInCycle, {
        quality: "ok",
        href: "/diretor/academico",
      }),
      metricCard("acad.enroll.occupying", acad.occupyingSeats, {
        quality: "ok",
        href: "/diretor/academico",
      }),
      metricCard("acad.suspension.count", acad.suspensions, {
        quality: "ok",
        href: "/diretor/academico",
      }),
    );
    if (acad.attendanceReliable && acad.nearSuspension > 0) {
      kpis.push(
        metricCard("acad.absence.near_suspension", acad.nearSuspension, {
          quality: "ok",
          href: "/diretor/academico",
        }),
      );
    }
    if (acad.attendanceReliable && acad.streakThree > 0) {
      kpis.push(
        metricCard("acad.absence.streak_three", acad.streakThree, {
          quality: "ok",
          href: "/diretor/academico",
        }),
      );
    }
    const servedLabel =
      servedExec.value == null
        ? null
        : acad.attendanceReliable
          ? acad.servedUnique
          : `${acad.servedUnique.toLocaleString("pt-BR")} alunos com presença registrada`;
    kpis.push(
      metricCard("ben.served_unique", servedExec.value, {
        quality: servedExec.quality,
        unavailableReason: servedExec.unavailableReason,
        href: "/diretor/academico",
        formattedValue: typeof servedLabel === "string" ? servedLabel : undefined,
        currentValue: servedExec.value,
        explanation:
          servedExec.value == null
            ? servedExec.unavailableReason ?? undefined
            : acad.attendanceReliable
              ? "Pessoas distintas com pelo menos uma presença em aula no recorte."
              : `Ao menos ${acad.servedUnique.toLocaleString("pt-BR")} alunos atendidos nos registros disponíveis. Não é alcance institucional definitivo.`,
      }),
    );
    if (acad.completionStartedRate != null) {
      kpis.push(
        metricCard("acad.completion.started_rate", acad.completionStartedRate, {
          quality: pq,
          href: "/diretor/academico",
          percentage: acad.completionStartedRate,
        }),
      );
    }
  }
  if (offer?.occupancyPercent != null) {
    kpis.push(
      metricCard("offer.occupancy.current", offer.occupancyPercent, {
        quality: "ok",
        href: "/diretor/oferta-territorios",
        percentage: offer.occupancyPercent,
        currentValue: offer.occupancyPercent,
        formattedValue: formatPtPercent(offer.occupancyPercent),
      }),
    );
  }
  if (social) {
    const donated = social.computersDonated;
    const target = social.computersTarget;
    const pct = social.computersProgressPct;
    const display =
      target != null
        ? `${donated.toLocaleString("pt-BR")} de ${target.toLocaleString("pt-BR")}${pct != null ? ` — ${formatPtPercent(pct)}` : ""}`
        : donated.toLocaleString("pt-BR");
    kpis.push(
      metricCard("soc.computers_donated", donated, {
        quality: target == null ? "partial" : "ok",
        href: "/diretor/impacto-social",
        labelOverride: "Equipamentos doados vs meta",
        explanation: "Doações registradas no ano comparadas à meta de equipamentos.",
        currentValue: donated,
        targetValue: target,
        percentage: pct,
        formattedValue: display,
      }),
    );
  }
  if (fin) {
    const netReading =
      fin.netPaidCents < 0
        ? `Os pagamentos superaram os recebimentos em ${formatCentsBRL(Math.abs(fin.netPaidCents))} no período.`
        : fin.netPaidCents > 0
          ? `Os recebimentos superaram os pagamentos em ${formatCentsBRL(fin.netPaidCents)} no período.`
          : "Recebimentos e pagamentos se equivalem no período.";
    kpis.push(
      metricCard("fin.net.paid", formatCentsBRL(fin.netPaidCents), {
        quality: "ok",
        href: "/diretor/financeiro",
        explanation: `${netReading} Isso não representa saldo bancário.`,
      }),
    );
  }

  const derived = alertsFromExecutiveFacts({
    academic: acad,
    offer,
    social,
    financial: fin,
    administrative: admin,
    projects,
  });
  const structural = derived.filter((a) => a.id === "proj-unavailable");
  const decision = derived.filter((a) => a.id !== "proj-unavailable" && a.severity !== "info");
  const watch = derived.filter((a) => a.id !== "proj-unavailable" && a.severity === "info");
  const alerts = topPriorityAlerts(decision, 5);
  const dataQuality: OverviewBundle["dataQuality"] = [
    ...structural.map((a) => ({ title: a.title, fact: a.fact, domain: a.domain })),
    ...domainStatus
      .filter((d) => d.status !== "ok")
      .map((d) => ({
        title: domainLabel(d.domain),
        fact: d.note ?? "Dados incompletos neste tema.",
        domain: d.domain,
      })),
  ];

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: opts.scope.dataAsOf.toISOString(),
      filters: {
        scope: opts.scope.scope,
        academicScope: opts.scope.scope,
        cycleId: opts.scope.cycleId,
        cycleLabel: opts.scope.cycleLabel,
        execCompetence: competence,
      },
      quality: domainStatus,
      formulaVersion: FORMULA_VERSION_1C,
      viewer: opts.viewer,
    },
    kpis: kpis.slice(0, 6),
    alerts,
    watchAlerts: watch,
    qualityNotes,
    domainStatus,
    dataQuality,
  };
}
