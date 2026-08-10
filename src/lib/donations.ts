import "server-only";

import { renderDocumentHtmlToPdfBytes } from "@/lib/admin/document-template-pdf";
import {
  buildDonationVariableMap,
  renderDocumentTemplateHtml,
} from "@/lib/admin/document-template-vars";
import { uploadGerenciaPdfBytes } from "@/lib/admin/gerencia-pdf-upload";
import { applyInventoryMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

export const donationInclude = {
  donataria: true,
  template: { select: { id: true, title: true, type: true } },
  items: {
    include: {
      inventoryItem: { select: { id: true, name: true, quantityOnHand: true, unit: true } },
    },
  },
  financialEntry: { select: { id: true, amountCents: true, description: true } },
} as const;

type DonationLoaded = Awaited<
  ReturnType<
    typeof prisma.donation.findFirstOrThrow<{ include: typeof donationInclude }>
  >
>;

export function serializeDonation(d: DonationLoaded) {
  return {
    id: d.id,
    donatariaId: d.donatariaId,
    kind: d.kind,
    donatedAt: d.donatedAt.toISOString().slice(0, 10),
    description: d.description,
    amountCents: d.amountCents,
    status: d.status,
    templateId: d.templateId,
    renderedHtml: d.renderedHtml,
    pdfUrl: d.pdfUrl,
    pdfPublicId: d.pdfPublicId,
    financialEntryId: d.financialEntryId,
    inventoryPosted: d.inventoryPosted,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    donataria: {
      id: d.donataria.id,
      name: d.donataria.name,
      document: d.donataria.document,
      contactName: d.donataria.contactName,
      city: d.donataria.city,
      state: d.donataria.state,
    },
    template: d.template,
    financialEntry: d.financialEntry,
    items: d.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      inventoryItemId: item.inventoryItemId,
      inventoryItem: item.inventoryItem,
    })),
  };
}

export async function confirmDonationSideEffects(opts: {
  donationId: string;
  actorId: string;
  postInventory: boolean;
  postFinancial: boolean;
  templateId?: string | null;
  generatePdf: boolean;
}) {
  const donation = await prisma.donation.findFirst({
    where: { id: opts.donationId, deletedAt: null },
    include: donationInclude,
  });
  if (!donation) throw new Error("NOT_FOUND");
  if (donation.status === "CONFIRMADA") throw new Error("ALREADY_CONFIRMED");
  if (donation.status === "CANCELADA") throw new Error("CANCELLED");

  let financialEntryId = donation.financialEntryId;
  let inventoryPosted = donation.inventoryPosted;
  let renderedHtml = donation.renderedHtml;
  let pdfUrl = donation.pdfUrl;
  let pdfPublicId = donation.pdfPublicId;
  let templateId = opts.templateId ?? donation.templateId;

  const shouldPostInventory =
    opts.postInventory &&
    !inventoryPosted &&
    (donation.kind === "BENS" || donation.kind === "MISTO") &&
    donation.items.some((i) => i.inventoryItemId);

  if (shouldPostInventory) {
    for (const item of donation.items) {
      if (!item.inventoryItemId || !item.inventoryItem) continue;
      if (item.quantity > item.inventoryItem.quantityOnHand) {
        throw new Error(
          `Estoque insuficiente para "${item.name}" (saldo: ${item.inventoryItem.quantityOnHand}).`,
        );
      }
    }
    for (const item of donation.items) {
      if (!item.inventoryItemId) continue;
      await applyInventoryMovement({
        itemId: item.inventoryItemId,
        type: "SAIDA",
        quantity: item.quantity,
        reason: `Doação para ${donation.donataria.name}`,
        donationId: donation.id,
        createdByUserId: opts.actorId,
      });
    }
    inventoryPosted = true;
  }

  if (
    opts.postFinancial &&
    !financialEntryId &&
    (donation.kind === "DINHEIRO" || donation.kind === "MISTO") &&
    donation.amountCents &&
    donation.amountCents > 0
  ) {
    const donationCategory = await prisma.financialCategory.findFirst({
      where: { kind: "SAIDA", isActive: true, name: { contains: "Doação", mode: "insensitive" } },
      select: { id: true },
    });
    const categoryId =
      donationCategory?.id ??
      (
        await prisma.financialCategory.findFirst({
          where: { kind: "SAIDA", isActive: true },
          select: { id: true },
        })
      )?.id ??
      null;

    const entry = await prisma.financialEntry.create({
      data: {
        kind: "SAIDA",
        description: `Doação para ${donation.donataria.name}${
          donation.description ? ` — ${donation.description}` : ""
        }`,
        amountCents: donation.amountCents,
        entryDate: donation.donatedAt,
        categoryId,
        paymentMethod: "PIX",
        responsibleUserId: opts.actorId,
        notes: `Doação ${donation.id}`,
        createdByUserId: opts.actorId,
      },
    });
    financialEntryId = entry.id;
  }

  if (opts.generatePdf) {
    const template = templateId
      ? await prisma.documentTemplate.findFirst({
          where: { id: templateId, type: "TERMO_DOACAO", isActive: true },
        })
      : await prisma.documentTemplate.findFirst({
          where: { type: "TERMO_DOACAO", isActive: true },
          orderBy: { updatedAt: "desc" },
        });

    if (template) {
      templateId = template.id;
      const vars = buildDonationVariableMap({
        donataria: donation.donataria,
        donatedAt: donation.donatedAt,
        description: donation.description,
        amountCents: donation.amountCents,
        items: donation.items,
      });
      renderedHtml = renderDocumentTemplateHtml(template.contentRich, vars);
      const bytes = await renderDocumentHtmlToPdfBytes(renderedHtml, template.title);
      const uploaded = await uploadGerenciaPdfBytes(
        bytes,
        `termo-doacao-${donation.donataria.name.replace(/\s+/g, "-").slice(0, 40)}.pdf`,
      );
      pdfUrl = uploaded.url;
      pdfPublicId = uploaded.publicId;
    }
  }

  return prisma.donation.update({
    where: { id: donation.id },
    data: {
      status: "CONFIRMADA",
      inventoryPosted,
      financialEntryId,
      templateId,
      renderedHtml,
      pdfUrl,
      pdfPublicId,
    },
    include: donationInclude,
  });
}
