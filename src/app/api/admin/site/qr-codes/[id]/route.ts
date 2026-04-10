import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await context.params;
  try {
    const r = await prisma.siteQrCode.deleteMany({ where: { id } });
    if (r.count === 0) return jsonErr("NOT_FOUND", "QR Code não encontrado.", 404);
    return jsonOk({ deleted: true });
  } catch {
    return jsonErr("SERVER_ERROR", "Erro ao excluir.", 500);
  }
}
