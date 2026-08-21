import { requireDirectorRead } from "@/lib/diretor/auth";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademicOfferBundle } from "@/lib/diretor/metrics/academic-offer";
import { parseSearchParams, prioritiesQuerySchema } from "@/lib/diretor/search-params";
import { jsonErr, jsonOk } from "@/lib/http";

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
      meta: bundle.meta,
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      alerts,
      qualityNotes: bundle.qualityNotes,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Acesso restrito ao perfil Diretor (ou preview Master).", 403);
    }
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    }
    console.error("[diretor/priorities]", e);
    return jsonErr("INTERNAL", "Falha ao montar prioridades.", 500);
  }
}
