import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("MASTER");
    const { id } = await context.params;

    const sessions = await prisma.classSession.findMany({
      where: { classGroupId: id },
      orderBy: { sessionDate: "asc" },
    });

    return jsonOk({ sessions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar aulas.";
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}

