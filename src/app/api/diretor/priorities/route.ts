import { requireDirectorRead } from "@/lib/diretor/auth";
import { collectDirectorAlerts } from "@/lib/diretor/alerts/engine";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademic } from "@/lib/diretor/metrics/academic";
import { loadAdministrative } from "@/lib/diretor/metrics/administrative";
import { loadFinancial } from "@/lib/diretor/metrics/financial";
import { loadOffer } from "@/lib/diretor/metrics/offer";
import { loadSocialImpact } from "@/lib/diretor/metrics/social";
import { defaultCompetence } from "@/lib/diretor/period";
import { parseSearchParams, prioritiesQuerySchema } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";
import type { DerivedAlertDto } from "@/lib/diretor/schemas/common";

async function settledAlerts(fn: () => Promise<{ alerts: DerivedAlertDto[] }>): Promise<DerivedAlertDto[]> {
  try {
    return (await fn()).alerts;
  } catch (e) {
    console.error("[diretor/priorities]", e);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(prioritiesQuerySchema, url);
    const scope = await resolveDirectorScope({ scope: q.scope, cycleId: q.cycleId });
    const competence = q.execCompetence ?? defaultCompetence(scope.dataAsOf);

    const groups = await Promise.all([
      settledAlerts(() => loadAcademic(scope, {}, viewer)),
      settledAlerts(() => loadOffer(scope, {}, viewer)),
      settledAlerts(() => loadFinancial({ competence }, viewer)),
      settledAlerts(() => loadAdministrative({ competence }, viewer)),
      settledAlerts(() => loadSocialImpact({ cycleId: q.cycleId }, viewer)),
    ]);
    let alerts = collectDirectorAlerts(groups);
    if (q.severity !== "all") alerts = alerts.filter((a) => a.severity === q.severity);
    if (q.domain !== "all") alerts = alerts.filter((a) => a.domain === q.domain);

    return jsonOk({
      meta: {
        generatedAt: new Date().toISOString(),
        dataAsOf: scope.dataAsOf.toISOString(),
        filters: {
          scope: q.scope,
          cycleId: scope.cycleId,
          severity: q.severity,
          domain: q.domain,
          execCompetence: competence,
        },
        quality: [{ domain: "overview", status: "ok" as const }],
        formulaVersion: "1B.0.0",
        viewer,
      },
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      alerts,
      qualityNotes: [],
    });
  } catch (e) {
    return directorApiError(e);
  }
}

export function POST() {
  return methodNotAllowed();
}
export function PATCH() {
  return methodNotAllowed();
}
export function DELETE() {
  return methodNotAllowed();
}
