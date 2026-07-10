import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffWrite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { id } = await context.params;
  const existing = await prisma.holidayEventRegistration.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Inscrição não encontrada.", 404);

  await prisma.holidayEventRegistration.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
