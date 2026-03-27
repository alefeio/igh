import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getApimagesConfig } from "@/lib/apimages";

/** Upload de anexos para reportes à coordenação. */
export async function POST() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const allowed =
    user.role === "TEACHER" ||
    user.role === "ADMIN" ||
    user.role === "MASTER" ||
    user.role === "COORDINATOR";
  if (!allowed) {
    return jsonErr("FORBIDDEN", "Sem permissão para anexar arquivos.", 403);
  }

  try {
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
