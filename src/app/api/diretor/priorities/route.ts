import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademicOfferBundle } from "@/lib/diretor/metrics/academic-offer";
import { parseSearchParams, prioritiesQuerySchema } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(prioritiesQuerySchema, url);
    const scope = await resolveDirectorScope({
      scope: q.scope,
      cycleId: q.cycleId,
    });
    const bundle = await loadAcademicOfferBundle(scope, {}, viewer);

    let alerts = bundle.alerts;
    if (q.severity !== "all") {
      alerts = alerts.filter((a) => a.severity === q.severity);
    }
    if (q.domain !== "all") {
      alerts = alerts.filter((a) => a.domain === q.domain);
    }

    return jsonOk({
      meta: {
        ...bundle.meta,
        filters: {
          ...bundle.meta.filters,
          severity: q.severity,
          domain: q.domain,
        },
      },
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      alerts,
      qualityNotes: bundle.qualityNotes,
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
