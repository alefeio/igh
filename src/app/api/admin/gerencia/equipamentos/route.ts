import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  ensureEquipmentCatalogSeeded,
  serializeEquipment,
} from "@/lib/equipment-catalog";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createEquipmentSchema } from "@/lib/validators/equipment-visits";

export async function GET() {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  await ensureEquipmentCatalogSeeded(actor.id);

  const items = await prisma.equipmentCatalogItem.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return jsonOk({
    items: items.map(serializeEquipment),
    kitComponents: items
      .filter((i) => i.isActive && i.quantityPerKit > 0)
      .map((i) => ({ name: i.name, quantityPerKit: i.quantityPerKit })),
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createEquipmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const item = await prisma.equipmentCatalogItem.create({
      data: { ...parsed.data, createdByUserId: actor.id },
    });
    await createAuditLog({
      entityType: "EquipmentCatalogItem",
      entityId: item.id,
      action: "CREATE",
      diff: { name: item.name, quantityPerKit: item.quantityPerKit },
      performedByUserId: actor.id,
    });
    return jsonOk({ item: serializeEquipment(item) }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe um equipamento com este nome.", 409);
    }
    throw e;
  }
}
