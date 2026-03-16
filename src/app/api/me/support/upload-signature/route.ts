import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getCloudinaryConfig, generateUploadSignature, getSupportUploadFolder } from "@/lib/cloudinary";

/** Gera assinatura Cloudinary para o aluno anexar arquivos ao chamado de suporte. */
export async function POST() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  try {
    const { apiKey, cloudName } = getCloudinaryConfig();
    const folder = getSupportUploadFolder(user.id);
    const { signature, timestamp } = generateUploadSignature({ folder });
    return jsonOk({ timestamp, signature, apiKey, cloudName, folder });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar permissão de upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
