import { requireDirectorRead } from "@/lib/diretor/auth";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademicOfferBundle } from "@/lib/diretor/metrics/academic-offer";
import { overviewQuerySchema, parseSearchParams } from "@/lib/diretor/search-params";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(overviewQuerySchema, url);
    const scope = await resolveDirectorScope({
      scope: q.scope,
      cycleId: q.cycleId,
    });
    const bundle = await loadAcademicOfferBundle(scope, {}, viewer);

    return jsonOk({
      meta: bundle.meta,
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      kpis: bundle.kpis.slice(0, 6),
      alerts: bundle.alerts.filter((a) => a.severity === "critical").slice(0, 5),
      qualityNotes: bundle.qualityNotes,
      links: {
        priorities: "/diretor/prioridades",
        academic: "/diretor/academico",
        offer: "/diretor/oferta-territorios",
        guide: "/diretor/guia",
        legacyDashboard: "/dashboard",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Acesso restrito ao perfil Diretor (ou preview Master).", 403);
    }
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    }
    console.error("[diretor/overview]", e);
    return jsonErr("INTERNAL", "Falha ao montar a visão geral.", 500);
  }
}
