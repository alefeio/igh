import { requireRole } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { getApimagesConfig } from "@/lib/apimages";
import { jsonErr, jsonOk } from "@/lib/http";

/** Assinatura Apimages para arquivos/imagens de aulas e cursos (planos de aula). */
export async function POST() {
  try {
    await requireRole(["MASTER", "ADMIN", "COORDINATOR", "TEACHER"]);
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
