import { getApimagesConfig } from "@/lib/apimages";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireEmployeePortal } from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";

export async function POST() {
  try {
    await requireEmployeePortal();
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
