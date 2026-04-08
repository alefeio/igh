import { requireRole } from "@/lib/auth";
import { getApimagesConfig } from "@/lib/apimages";
import { jsonErr, jsonOk } from "@/lib/http";

export async function POST() {
  await requireRole(["TEACHER"]);
  try {
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}

