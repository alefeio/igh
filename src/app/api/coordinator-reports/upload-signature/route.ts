import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getCloudinaryConfig, generateUploadSignature, getCoordinatorReportUploadFolder } from "@/lib/cloudinary";

/** Upload de anexos para reportes à coordenação (professor, admin, master, coordenador nas respostas). */
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
    const { apiKey, cloudName } = getCloudinaryConfig();
    const folder = getCoordinatorReportUploadFolder(user.id);
    const { signature, timestamp } = generateUploadSignature({ folder });
    return jsonOk({ timestamp, signature, apiKey, cloudName, folder });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar permissão de upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
