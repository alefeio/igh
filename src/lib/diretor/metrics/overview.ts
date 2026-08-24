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
import { domainLabel } from "@/lib/diretor/ui-labels";
import { formatCentsBRL } from "@/lib/employees";

export type OverviewBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  alerts: DerivedAlertDto[];
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

  if (acad) {
    kpis.push(
      metricCard("ben.served_unique", acad.servedUnique, {
        quality: "ok",
        href: "/diretor/academico",
        explanation: "Pessoas distintas com pelo menos uma presença em aula no recorte.",
      }),
    );
    if (acad.completionStartedRate != null) {
      kpis.push(
        metricCard("acad.completion.started_rate", acad.completionStartedRate, { quality: "ok", href: "/diretor/academico" }),
      );
    }
    kpis.push(
      metricCard("acad.attrition.risk.critical_absences", acad.criticalAbsenceRisk, {
        quality: "ok",
        href: "/diretor/academico",
      }),
    );
  }
  if (offer?.occupancyPercent != null) {
    kpis.push(metricCard("offer.occupancy.current", offer.occupancyPercent, { quality: "ok", href: "/diretor/oferta-territorios" }));
  }
  if (social) {
    const donated = social.computersDonated;
    const target = social.computersTarget;
    const pct = social.computersProgressPct;
    const display =
      target != null
        ? `${donated.toLocaleString("pt-BR")} de ${target.toLocaleString("pt-BR")}${pct != null ? ` — ${pct}%` : ""}`
        : donated.toLocaleString("pt-BR");
    kpis.push(
      metricCard("soc.computers_donated", display, {
        quality: target == null ? "partial" : "ok",
        href: "/diretor/impacto-social",
        labelOverride: "Equipamentos doados vs meta",
        explanation: "Doações confirmadas no ano comparadas à meta de equipamentos.",
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
  const alerts = topPriorityAlerts(
    derived.filter((a) => a.id !== "proj-unavailable"),
    5,
  );
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
    qualityNotes,
    domainStatus,
    dataQuality,
  };
}
