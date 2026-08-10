import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { applyInventoryMovement } from "@/lib/inventory";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  createInventoryItemSchema,
} from "@/lib/validators/inventory-donations";

function serializeItem(item: {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  unit: string;
  minStock: number;
  location: string | null;
  photoUrl: string | null;
  photoPublicId: string | null;
  quantityOnHand: number;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...item,
    lowStock: item.quantityOnHand <= item.minStock,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const lowOnly = new URL(request.url).searchParams.get("lowStock") === "true";
  const items = await prisma.inventoryItem.findMany({
    where: { deletedAt: null, ...(lowOnly ? {} : {}) },
    orderBy: [{ name: "asc" }],
  });

  const mapped = items.map(serializeItem);
  const filtered = lowOnly ? mapped.filter((i) => i.lowStock && i.isActive) : mapped;
  const lowStockCount = mapped.filter((i) => i.isActive && i.lowStock).length;

  return jsonOk({ items: filtered, lowStockCount, total: mapped.length });
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
  const parsed = createInventoryItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { initialQuantity, code, ...rest } = parsed.data;
  const normalizedCode = code?.trim() ? code.trim() : null;

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        ...rest,
        code: normalizedCode,
        createdByUserId: actor.id,
      },
    });

    if (initialQuantity && initialQuantity > 0) {
      await applyInventoryMovement({
        itemId: item.id,
        type: "ENTRADA",
        quantity: initialQuantity,
        reason: "Saldo inicial",
        createdByUserId: actor.id,
      });
    }

    const fresh = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });

    await createAuditLog({
      entityType: "InventoryItem",
      entityId: item.id,
      action: "CREATE",
      diff: { name: item.name, code: item.code, initialQuantity },
      performedByUserId: actor.id,
    });

    return jsonOk({ item: serializeItem(fresh) }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe um item com este código.", 409);
    }
    throw e;
  }
}
