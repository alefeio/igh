import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { parseCoordinatorQuery } from "@/lib/coordinator/filters";
import { loadCoordinatorHistory, loadCoordinatorSnapshot } from "@/lib/coordinator/snapshot";
import { jsonOk } from "@/lib/http";

async function authorize() {
  try {
    await requireCoordenacaoViewer();
    return null;
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
}

export async function GET(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "historico") {
    return jsonOk({ rows: await loadCoordinatorHistory() });
  }
  const snapshot = await loadCoordinatorSnapshot(parseCoordinatorQuery(url));
  return jsonOk(snapshot);
}
