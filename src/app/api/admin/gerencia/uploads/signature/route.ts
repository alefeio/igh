import { getApimagesConfig } from "@/lib/apimages";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Assinatura Apimages para documentos da Gerência Administrativa. */
export async function POST() {
  try {
    await requireAdminManagerWrite();
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
