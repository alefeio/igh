import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireSessionUser } from "@/lib/auth";
import { getApimagesConfig } from "@/lib/apimages";
import { jsonErr, jsonOk } from "@/lib/http";

/** Upload de foto e assinatura do próprio usuário em Meus dados. */
export async function POST() {
  try {
    await requireSessionUser();
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
