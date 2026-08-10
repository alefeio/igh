import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { applyInventoryMovement } from "@/lib/inventory";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createInventoryMovementSchema } from "@/lib/validators/inventory-donations";

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
  const parsed = createInventoryMovementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const result = await applyInventoryMovement({
      ...parsed.data,
      createdByUserId: actor.id,
    });

    await createAuditLog({
      entityType: "InventoryItem",
      entityId: parsed.data.itemId,
      action: "MOVEMENT",
      diff: {
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        movementId: result.movement.id,
        quantityOnHand: result.quantityOnHand,
      },
      performedByUserId: actor.id,
    });

    const item = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: parsed.data.itemId },
    });

    return jsonOk(
      {
        movement: {
          ...result.movement,
          createdAt: result.movement.createdAt.toISOString(),
        },
        item: {
          ...item,
          lowStock: item.quantityOnHand <= item.minStock,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha no movimento.";
    if (message === "ITEM_NOT_FOUND") return jsonErr("NOT_FOUND", "Item não encontrado.", 404);
    if (message.startsWith("Estoque insuficiente") || message.startsWith("Quantidade")) {
      return jsonErr("INVALID_STATE", message, 400);
    }
    throw e;
  }
}
