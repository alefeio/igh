import "server-only";

import { FORMULA_VERSION_1B } from "@/lib/diretor/catalog/definitions";
import { collectDirectorAlerts, topPriorityAlerts } from "@/lib/diretor/alerts/engine";
import { summarizeAcademic } from "@/lib/diretor/metrics/academic";
import { summarizeAdministrative } from "@/lib/diretor/metrics/administrative";
import { summarizeFinancial } from "@/lib/diretor/metrics/financial";
import { summarizeOffer } from "@/lib/diretor/metrics/offer";
import { summarizeSocial } from "@/lib/diretor/metrics/social";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import { defaultCompetence } from "@/lib/diretor/period";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import { formatCentsBRL } from "@/lib/employees";

export type OverviewBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
  domainStatus: Array<{ domain: string; status: "ok" | "partial" | "unavailable"; note?: string }>;
};

async function settled<T>(label: string, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    console.error(`[diretor/overview] ${label}`, e);
    return { ok: false, error: `Falha no domínio ${label}.` };
  }
}

export async function loadOverviewSummaries(opts: {
  scope: ScopeResolution;
  viewer: "DIRECTOR" | "MASTER";
  execCompetence?: string;
}): Promise<OverviewBundle> {
  const competence = opts.execCompetence ?? defaultCompetence(opts.scope.dataAsOf);
  const [acad, offer, fin, social, admin] = await Promise.all([
    settled("academic", () => summarizeAcademic(opts.scope, opts.viewer)),
    settled("offer", () => summarizeOffer(opts.scope, opts.viewer)),
    settled("financial", () => summarizeFinancial({ competence }, opts.viewer)),
    settled("social", () => summarizeSocial({}, opts.viewer)),
    settled("administrative", () => summarizeAdministrative({ competence }, opts.viewer)),
  ]);

  const qualityNotes: string[] = [];
  const domainStatus: OverviewBundle["domainStatus"] = [];
  const alertGroups: DerivedAlertDto[][] = [];
  const kpis: MetricValueDto[] = [];

  function takeDomain(
    name: string,
    r:
      | {
          ok: true;
          value: {
            quality: ResponseMetaDto["quality"];
            qualityNotes?: string[];
            alerts?: DerivedAlertDto[];
          };
        }
      | { ok: false; error: string },
  ) {
    if (!r.ok) {
      domainStatus.push({ domain: name, status: "unavailable", note: r.error });
      qualityNotes.push(r.error);
      return;
    }
    domainStatus.push(...r.value.quality.map((q) => ({ domain: q.domain, status: q.status, note: q.note })));
    qualityNotes.push(...(r.value.qualityNotes ?? []));
    if (r.value.alerts) alertGroups.push(r.value.alerts);
  }

  takeDomain("academic", acad);
  takeDomain("offer", offer);
  takeDomain("financial", fin);
  takeDomain("social", social);
  takeDomain("administrative", admin);

  if (social.ok) {
    kpis.push(
      metricCard("soc.served_unique", social.value.servedUnique, {
        quality: "ok",
        href: "/diretor/impacto-social",
      }),
    );
  }
  if (acad.ok && acad.value.completionStartedRate != null) {
    kpis.push(
      metricCard("acad.completion.started_rate", acad.value.completionStartedRate, {
        quality: "ok",
        href: "/diretor/academico",
      }),
    );
  }
  if (acad.ok) {
    kpis.push(
      metricCard("acad.attrition.risk.critical_absences", acad.value.criticalAbsenceRisk, {
        quality: "ok",
        href: "/diretor/academico",
      }),
    );
  }
  if (offer.ok && offer.value.occupancyPercent != null) {
    kpis.push(
      metricCard("offer.occupancy.current", offer.value.occupancyPercent, {
        quality: "ok",
        href: "/diretor/oferta-territorios",
      }),
    );
  }
  if (social.ok && social.value.computersProgressPct != null) {
    kpis.push(
      metricCard("soc.computers_donated", social.value.computersProgressPct, {
        quality: "ok",
        href: "/diretor/impacto-social",
        labelOverride: "Equipamentos doados vs meta",
      }),
    );
  }
  if (fin.ok) {
    kpis.push(
      metricCard("fin.net.paid", formatCentsBRL(fin.value.netPaidCents), {
        quality: "ok",
        href: "/diretor/financeiro",
      }),
    );
  }

  const alerts = topPriorityAlerts(collectDirectorAlerts(alertGroups), 5);

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
      formulaVersion: FORMULA_VERSION_1B,
      viewer: opts.viewer,
    },
    kpis: kpis.slice(0, 6),
    alerts,
    qualityNotes,
    domainStatus,
  };
}
