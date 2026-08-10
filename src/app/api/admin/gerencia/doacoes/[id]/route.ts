import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { donationInclude, serializeDonation } from "@/lib/donations";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const donation = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    include: donationInclude,
  });
  if (!donation) return jsonErr("NOT_FOUND", "Doação não encontrada.", 404);
  return jsonOk({ donation: serializeDonation(donation) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, inventoryPosted: true, financialEntryId: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Doação não encontrada.", 404);

  if (existing.status === "CONFIRMADA" && (existing.inventoryPosted || existing.financialEntryId)) {
    return jsonErr(
      "INVALID_STATE",
      "Doação confirmada com estoque/financeiro lançado não pode ser excluída. Cancele apenas se ainda estiver em rascunho.",
      400,
    );
  }

  await prisma.donation.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: existing.status === "RASCUNHO" ? "CANCELADA" : existing.status,
    },
  });

  await createAuditLog({
    entityType: "Donation",
    entityId: id,
    action: "ARCHIVE",
    diff: { previousStatus: existing.status },
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
