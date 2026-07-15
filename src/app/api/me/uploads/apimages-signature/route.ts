import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getApimagesConfig } from "@/lib/apimages";
import { getOrCreateStudentForUser } from "@/lib/student-account";

/** Permissão de upload Apimages para o aluno logado (documento, comprovante). Apenas STUDENT. */
export async function POST() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  await getOrCreateStudentForUser(user);

  try {
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
