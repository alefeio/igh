import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/**
 * Cidade/UF padrão do cadastro de aluno (Configurações → Certificados).
 * Usado por quem cadastra alunos (Admin, Master, Coordenador de Polo).
 */
export async function GET() {
  await requireRole(["ADMIN", "MASTER", "POLO_COORDINATOR", "TEACHER"]);
  try {
    const settings = await prisma.siteSettings.findFirst({
      select: { certificateCity: true, certificateCityState: true },
    });
    const city = settings?.certificateCity?.trim() ?? "";
    const state = (settings?.certificateCityState?.trim() ?? "").toUpperCase().slice(0, 2);
    return jsonOk({ city, state });
  } catch {
    return jsonErr("SERVER_ERROR", "Erro ao carregar cidade/UF padrão.", 500);
  }
}
