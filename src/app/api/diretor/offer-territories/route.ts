import { requireDirectorRead } from "@/lib/diretor/auth";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { loadAcademicOfferBundle } from "@/lib/diretor/metrics/academic-offer";
import { getMetricDefinition } from "@/lib/diretor/catalog/definitions";
import { offerQuerySchema, parseSearchParams } from "@/lib/diretor/search-params";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { viewer } = await requireDirectorRead();
    const url = new URL(request.url);
    const q = parseSearchParams(offerQuerySchema, url);
    const scope = await resolveDirectorScope({
      scope: q.scope,
      cycleId: q.cycleId,
    });
    const bundle = await loadAcademicOfferBundle(
      scope,
      { courseId: q.courseId, poloId: q.poloId },
      viewer,
    );

    return jsonOk({
      meta: bundle.meta,
      cycleLabel: scope.cycleLabel,
      cycles: scope.cycles,
      offer: bundle.offer,
      metrics: {
        occupancy: getMetricDefinition("offer.occupancy.current"),
        waitlist: getMetricDefinition("offer.waitlist.count"),
        acceptRate: getMetricDefinition("offer.seat_offer.accept_rate"),
        lowOccupancy: getMetricDefinition("offer.low_occupancy.classes"),
      },
      qualityNotes: bundle.qualityNotes,
      note:
        "Ocupação inicial não é exibida na Visão Geral nem como KPI principal nesta fase (apenas estimativa futura). Tempo para preenchimento: indisponível sem data confiável de abertura da oferta.",
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Acesso restrito ao perfil Diretor (ou preview Master).", 403);
    }
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    }
    console.error("[diretor/offer-territories]", e);
    return jsonErr("INTERNAL", "Falha ao montar oferta e territórios.", 500);
  }
}
