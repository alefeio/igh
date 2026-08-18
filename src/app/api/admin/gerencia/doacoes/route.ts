import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getKitComponentsFromCatalog } from "@/lib/equipment-catalog";
import { expandDonationKitItems } from "@/lib/donation-kits";
import {
  confirmDonationSideEffects,
  donationInclude,
  resolveDonationItems,
  serializeDonation,
} from "@/lib/donations";
import { resolveDonorInstitution } from "@/lib/donor-institution";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createDonationSchema } from "@/lib/validators/inventory-donations";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const donatariaId = searchParams.get("donatariaId");
  const kind = searchParams.get("kind");

  const donations = await prisma.donation.findMany({
    where: {
      deletedAt: null,
      ...(status === "RASCUNHO" || status === "CONFIRMADA" || status === "CANCELADA"
        ? { status }
        : {}),
      ...(donatariaId ? { donatariaId } : {}),
      ...(kind === "BENS" || kind === "DINHEIRO" || kind === "MISTO" ? { kind } : {}),
    },
    orderBy: [{ donatedAt: "desc" }, { createdAt: "desc" }],
    include: donationInclude,
  });

  return jsonOk({ donations: donations.map(serializeDonation) });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createDonationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  const donataria = await prisma.donataria.findFirst({
    where: { id: data.donatariaId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!donataria) return jsonErr("NOT_FOUND", "Donatária não encontrada.", 404);

  const donor = await resolveDonorInstitution(data.donorInstitutionId, actor.id);
  if (data.donorInstitutionId && donor.id !== data.donorInstitutionId) {
    return jsonErr("NOT_FOUND", "Doadora não encontrada.", 404);
  }

  if (data.templateId) {
    const template = await prisma.documentTemplate.findFirst({
      where: { id: data.templateId, type: "TERMO_DOACAO", isActive: true },
      select: { id: true },
    });
    if (!template) return jsonErr("NOT_FOUND", "Modelo de termo de doação não encontrado.", 404);
  }

  const kitComponents = await getKitComponentsFromCatalog();
  const resolvedItems =
    data.items.length > 0
      ? resolveDonationItems({ kitsCount: data.kitsCount, items: data.items })
      : expandDonationKitItems(data.kitsCount, kitComponents).map((i) => ({
          ...i,
          inventoryItemId: null as string | null,
        }));

  if ((data.kind === "BENS" || data.kind === "MISTO") && resolvedItems.length === 0) {
    return jsonErr("VALIDATION_ERROR", "Informe kits ou ao menos um item para doação de bens.", 400);
  }

  // Tenta vincular itens do kit ao estoque pelo nome (baixa automática quando houver match).
  const stockByName = await prisma.inventoryItem.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, name: true },
  });
  const nameIndex = new Map(stockByName.map((i) => [i.name.trim().toLowerCase(), i.id]));
  const linkedItems = resolvedItems.map((item) => {
    if (item.inventoryItemId) return item;
    const matchId = nameIndex.get(item.name.trim().toLowerCase());
    return matchId ? { ...item, inventoryItemId: matchId } : item;
  });

  for (const item of linkedItems) {
    if (!item.inventoryItemId) continue;
    const inv = await prisma.inventoryItem.findFirst({
      where: { id: item.inventoryItemId, deletedAt: null },
      select: { id: true },
    });
    if (!inv) {
      return jsonErr("NOT_FOUND", `Item de estoque não encontrado: ${item.name}.`, 404);
    }
  }

  const created = await prisma.donation.create({
    data: {
      donatariaId: data.donatariaId,
      donorInstitutionId: donor.id,
      kind: data.kind,
      donatedAt: data.donatedAt,
      description: data.description ?? null,
      amountCents: data.amount ?? null,
      kitsCount: data.kitsCount,
      belongsTo: data.belongsTo ?? null,
      placeDateText: data.placeDateText ?? null,
      templateId: data.templateId ?? null,
      status: "RASCUNHO",
      createdByUserId: actor.id,
      items: {
        create: linkedItems.map((item) => ({
          inventoryItemId: item.inventoryItemId ?? null,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
      },
    },
    include: donationInclude,
  });

  await createAuditLog({
    entityType: "Donation",
    entityId: created.id,
    action: "CREATE",
    diff: { donatariaId: data.donatariaId, donorInstitutionId: donor.id, kind: data.kind, status: "RASCUNHO" },
    performedByUserId: actor.id,
  });

  if (data.confirmNow) {
    try {
      const confirmed = await confirmDonationSideEffects({
        donationId: created.id,
        actorId: actor.id,
        postInventory: data.postInventory,
        postFinancial: data.postFinancial,
        templateId: data.templateId,
        generatePdf: data.generatePdf,
      });
      await createAuditLog({
        entityType: "Donation",
        entityId: created.id,
        action: "CONFIRM",
        diff: {
          inventoryPosted: confirmed.inventoryPosted,
          financialEntryId: confirmed.financialEntryId,
          pdfUrl: confirmed.pdfUrl,
        },
        performedByUserId: actor.id,
      });
      return jsonOk({ donation: serializeDonation(confirmed) }, { status: 201 });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao confirmar doação.";
      if (message === "NOT_FOUND") return jsonErr("NOT_FOUND", "Doação não encontrada.", 404);
      if (message.startsWith("Estoque insuficiente")) {
        return jsonErr(
          "INVALID_STATE",
          `${message} A doação ficou salva como rascunho.`,
          400,
        );
      }
      throw e;
    }
  }

  return jsonOk({ donation: serializeDonation(created) }, { status: 201 });
}
