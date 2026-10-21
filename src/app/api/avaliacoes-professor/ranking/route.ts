import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { COORDENACAO_ROLES } from "@/lib/coordenacao-access";
import { jsonErr, jsonOk } from "@/lib/http";
import { listPublicTeacherEvaluationRanking } from "@/lib/teacher-class-evaluation-query";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["TEACHER", ...COORDENACAO_ROLES]);
    const ranking = await listPublicTeacherEvaluationRanking();
    return jsonOk({ ranking });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar o ranking.", 500);
  }
}
