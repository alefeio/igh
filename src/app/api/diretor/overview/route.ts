import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadOverviewSummaries } from "@/lib/diretor/metrics/overview";
import { overviewQuerySchema, parseSearchParams } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(overviewQuerySchema, url);
    const scope = await resolveDirectorScope({ scope: q.scope, cycleId: q.cycleId });
    const overview = await loadOverviewSummaries({
      scope,
      viewer,
      execCompetence: q.execCompetence,
    });

    return jsonOk({
      meta: overview.meta,
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      kpis: overview.kpis,
      alerts: overview.alerts,
      qualityNotes: overview.qualityNotes,
      domainStatus: overview.domainStatus,
      dataQuality: overview.dataQuality,
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
