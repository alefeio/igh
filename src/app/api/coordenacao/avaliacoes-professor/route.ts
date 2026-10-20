import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { jsonErr, jsonOk } from "@/lib/http";
import { listTeacherClassEvaluations } from "@/lib/teacher-class-evaluation-query";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCoordenacaoViewer();
    const items = await listTeacherClassEvaluations(undefined, {
      revealIdentity: true,
      includeAnonymous: true,
    });
    return jsonOk({ items });
  } catch (e) {
    const auth = coordenacaoAuthResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar as avaliações.", 500);
  }
}
