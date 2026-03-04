import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { generateUploadSignature, getCloudinaryConfig, getStudentUploadFolder } from "@/lib/cloudinary";

/** Gera assinatura Cloudinary para o aluno logado enviar seus anexos (documento, comprovante). Apenas STUDENT. */
export async function POST() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Cadastro não encontrado.", 404);
  }

  try {
    const { apiKey, cloudName } = getCloudinaryConfig();
    const folder = getStudentUploadFolder(student.id);
    const { signature, timestamp } = generateUploadSignature({ folder });
    return jsonOk({ timestamp, signature, apiKey, cloudName, folder });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar permissão de upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
