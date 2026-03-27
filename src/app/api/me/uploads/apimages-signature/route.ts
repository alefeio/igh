import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getApimagesConfig, getStudentUploadFolder } from "@/lib/apimages";

/** Permissão de upload Apimages para o aluno logado (documento, comprovante). Apenas STUDENT. */
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
    const { apiKey, uploadUrl } = getApimagesConfig();
    const folder = getStudentUploadFolder(student.id);
    return jsonOk({ uploadUrl, apiKey, folder });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
