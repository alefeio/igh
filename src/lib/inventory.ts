import "server-only";

import type { InventoryMovementType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function computeQuantityDelta(
  type: InventoryMovementType,
  quantity: number,
  currentStock: number,
): { quantityDelta: number; nextStock: number } {
  if (quantity <= 0) throw new Error("Quantidade deve ser maior que zero.");
  if (type === "ENTRADA") {
    return { quantityDelta: quantity, nextStock: currentStock + quantity };
  }
  if (type === "SAIDA") {
    if (quantity > currentStock) {
      throw new Error(`Estoque insuficiente (saldo atual: ${currentStock}).`);
    }
    return { quantityDelta: -quantity, nextStock: currentStock - quantity };
  }
  // AJUSTE: quantity é o novo saldo absoluto
  return { quantityDelta: quantity - currentStock, nextStock: quantity };
}

/** Recalcula o saldo somando os deltas (conferência / correção). */
export async function recalculateInventoryStock(itemId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const agg = await db.inventoryMovement.aggregate({
    where: { itemId },
    _sum: { quantityDelta: true },
  });
  const quantityOnHand = agg._sum.quantityDelta ?? 0;
  await db.inventoryItem.update({
    where: { id: itemId },
    data: { quantityOnHand },
  });
  return quantityOnHand;
}

export async function applyInventoryMovement(input: {
  itemId: string;
  type: InventoryMovementType;
  quantity: number;
  reason?: string | null;
  responsibleUserId?: string | null;
  responsibleName?: string | null;
  notes?: string | null;
  donationId?: string | null;
  createdByUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({
      where: { id: input.itemId, deletedAt: null },
      select: { id: true, quantityOnHand: true, name: true },
    });
    if (!item) throw new Error("ITEM_NOT_FOUND");

    let quantityDelta: number;
    let nextStock: number;
    try {
      ({ quantityDelta, nextStock } = computeQuantityDelta(
        input.type,
        input.quantity,
        item.quantityOnHand,
      ));
    } catch (e) {
      throw e;
    }

    const movement = await tx.inventoryMovement.create({
      data: {
        itemId: item.id,
        type: input.type,
        quantity: input.quantity,
        quantityDelta,
        reason: input.reason ?? null,
        responsibleUserId: input.responsibleUserId ?? null,
        responsibleName: input.responsibleName ?? null,
        notes: input.notes ?? null,
        donationId: input.donationId ?? null,
        createdByUserId: input.createdByUserId,
      },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantityOnHand: nextStock },
    });

    return { movement, quantityOnHand: nextStock };
  });
}
