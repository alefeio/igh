import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getKitComponentsFromCatalog } from "@/lib/equipment-catalog";
import { expandDonationKitItems } from "@/lib/donation-kits";
import {
  archiveDonationRecord,
  donationInclude,
  replaceDonationAttachments,
  resolveDonationItems,
  serializeDonation,
} from "@/lib/donations";
import { resolveDonorInstitution } from "@/lib/donor-institution";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateDonationDraftSchema } from "@/lib/validators/inventory-donations";

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

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Doação não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateDonationDraftSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  const fieldKeys = Object.keys(data).filter((k) => k !== "attachments");
  const attachmentsOnly = fieldKeys.length === 0 && data.attachments !== undefined;

  if (existing.status !== "RASCUNHO" && !attachmentsOnly) {
    return jsonErr(
      "INVALID_STATE",
      "Somente rascunhos podem ter os dados do termo editados. Anexos podem ser atualizados em qualquer status.",
      400,
    );
  }

  if (data.donatariaId) {
    const donataria = await prisma.donataria.findFirst({
      where: { id: data.donatariaId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!donataria) return jsonErr("NOT_FOUND", "Donatária não encontrada.", 404);
  }

  if (data.donorInstitutionId) {
    const donor = await resolveDonorInstitution(data.donorInstitutionId, actor.id);
    if (donor.id !== data.donorInstitutionId) {
      return jsonErr("NOT_FOUND", "Doadora não encontrada.", 404);
    }
  }

  if (data.templateId) {
    const template = await prisma.documentTemplate.findFirst({
      where: { id: data.templateId, type: "TERMO_DOACAO", isActive: true },
      select: { id: true },
    });
    if (!template) return jsonErr("NOT_FOUND", "Modelo de termo de doação não encontrado.", 404);
  }

  let linkedItems:
    | Array<{ inventoryItemId: string | null; name: string; quantity: number; unit: string }>
    | undefined;

  if (data.items !== undefined || data.kitsCount !== undefined) {
    const kitsCount = data.kitsCount ?? 0;
    const kitComponents = await getKitComponentsFromCatalog();
    const resolvedItems =
      data.items && data.items.length > 0
        ? resolveDonationItems({ kitsCount, items: data.items })
        : expandDonationKitItems(kitsCount, kitComponents).map((i) => ({
            ...i,
            inventoryItemId: null as string | null,
          }));

    const stockByName = await prisma.inventoryItem.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
    });
    const nameIndex = new Map(stockByName.map((i) => [i.name.trim().toLowerCase(), i.id]));
    linkedItems = resolvedItems.map((item) => {
      if (item.inventoryItemId) return item;
      const matchId = nameIndex.get(item.name.trim().toLowerCase());
      return matchId ? { ...item, inventoryItemId: matchId } : item;
    });
  }

  if (data.attachments !== undefined) {
    await replaceDonationAttachments({ donationId: id, attachments: data.attachments });
  }

  const donation = await prisma.$transaction(async (tx) => {
    if (linkedItems) {
      await tx.donationItem.deleteMany({ where: { donationId: id } });
      if (linkedItems.length > 0) {
        await tx.donationItem.createMany({
          data: linkedItems.map((item) => ({
            donationId: id,
            inventoryItemId: item.inventoryItemId ?? null,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }
    }

    return tx.donation.update({
      where: { id },
      data: {
        ...(data.donatariaId !== undefined ? { donatariaId: data.donatariaId } : {}),
        ...(data.donorInstitutionId !== undefined ? { donorInstitutionId: data.donorInstitutionId } : {}),
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.donatedAt !== undefined ? { donatedAt: data.donatedAt } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount !== undefined ? { amountCents: data.amount } : {}),
        ...(data.kitsCount !== undefined ? { kitsCount: data.kitsCount } : {}),
        ...(data.belongsTo !== undefined ? { belongsTo: data.belongsTo } : {}),
        ...(data.placeDateText !== undefined ? { placeDateText: data.placeDateText } : {}),
        ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
      },
      include: donationInclude,
    });
  });

  await createAuditLog({
    entityType: "Donation",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(data), attachmentsOnly },
    performedByUserId: actor.id,
  });

  return jsonOk({ donation: serializeDonation(donation) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;

  let archived;
  try {
    archived = await archiveDonationRecord({ donationId: id, actorId: actor.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "NOT_FOUND") return jsonErr("NOT_FOUND", "Doação não encontrada.", 404);
    throw e;
  }

  await createAuditLog({
    entityType: "Donation",
    entityId: id,
    action: "ARCHIVE",
    diff: {
      previousStatus: archived.previousStatus,
      inventoryReversed: archived.inventoryReversed,
      financialArchived: archived.financialArchived,
    },
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
