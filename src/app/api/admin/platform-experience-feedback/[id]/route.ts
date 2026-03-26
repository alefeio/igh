import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { Prisma } from "@/generated/prisma/client";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("MASTER");
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Sessão não encontrada.", 401);
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Apenas o usuário Master pode excluir avaliações.", 403);
    }
    throw e;
  }
  const { id } = await context.params;
  if (!id?.trim()) {
    return jsonErr("BAD_REQUEST", "Identificador inválido.", 400);
  }

  try {
    await prisma.platformExperienceFeedback.delete({
      where: { id },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return jsonErr("NOT_FOUND", "Avaliação não encontrada.", 404);
    }
    throw e;
  }

  return jsonOk({ deleted: true });
}
