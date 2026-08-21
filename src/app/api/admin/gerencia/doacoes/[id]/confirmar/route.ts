import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { confirmDonationSideEffects, serializeDonation } from "@/lib/donations";
import { jsonErr, jsonOk } from "@/lib/http";
import { confirmDonationSchema } from "@/lib/validators/inventory-donations";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = confirmDonationSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const confirmed = await confirmDonationSideEffects({
      donationId: id,
      actorId: actor.id,
      postInventory: parsed.data.postInventory,
      postFinancial: parsed.data.postFinancial,
      templateId: parsed.data.templateId,
      generatePdf: parsed.data.generatePdf,
    });

    await createAuditLog({
      entityType: "Donation",
      entityId: id,
      action: "CONFIRM",
      diff: {
        inventoryPosted: confirmed.inventoryPosted,
        financialEntryId: confirmed.financialEntryId,
        pdfUrl: confirmed.pdfUrl,
      },
      performedByUserId: actor.id,
    });

    return jsonOk({ donation: serializeDonation(confirmed) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao confirmar doação.";
    if (message === "NOT_FOUND") return jsonErr("NOT_FOUND", "Doação não encontrada.", 404);
    if (message === "ALREADY_CONFIRMED") {
      return jsonErr("INVALID_STATE", "Esta doação já foi confirmada.", 400);
    }
    if (message === "CANCELLED") {
      return jsonErr("INVALID_STATE", "Doação cancelada não pode ser confirmada.", 400);
    }
    if (message.startsWith("Estoque insuficiente")) {
      return jsonErr("INVALID_STATE", message, 400);
    }
    throw e;
  }
}
