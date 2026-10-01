import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { parseCoordinatorQuery } from "@/lib/coordinator/filters";
import { loadCoordinatorSnapshot } from "@/lib/coordinator/snapshot";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
  return jsonOk(await loadCoordinatorSnapshot(parseCoordinatorQuery(new URL(request.url))));
}
