import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademicOfferBundle } from "@/lib/diretor/metrics/academic-offer";
import { overviewQuerySchema, parseSearchParams } from "@/lib/diretor/search-params";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(overviewQuerySchema, url);
    const scope = await resolveDirectorScope({
      scope: q.scope,
      cycleId: q.cycleId,
    });

    let bundle: Awaited<ReturnType<typeof loadAcademicOfferBundle>> | null = null;
    let loadError: string | null = null;
    try {
      bundle = await loadAcademicOfferBundle(scope, {}, viewer);
    } catch (err) {
      console.error("[diretor/overview] partial failure", err);
      loadError = "Falha parcial ao agregar indicadores; tente atualizar.";
    }

    if (!bundle) {
      return jsonOk({
        meta: {
          generatedAt: new Date().toISOString(),
          dataAsOf: scope.dataAsOf.toISOString(),
          filters: { scope: scope.scope, cycleId: scope.cycleId, cycleLabel: scope.cycleLabel },
          quality: [{ domain: "overview", status: "unavailable" as const, note: loadError ?? undefined }],
          formulaVersion: "1A.0.0",
          viewer,
        },
        cycleLabel: scope.cycleLabel,
        cycles: scope.cycles,
        kpis: [],
        alerts: [],
        qualityNotes: [loadError ?? "Dados indisponíveis"],
        links: {
          priorities: "/diretor/prioridades",
          academic: "/diretor/academico",
          offer: "/diretor/oferta-territorios",
          guide: "/diretor/guia",
          legacyDashboard: "/dashboard",
        },
      });
    }

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
