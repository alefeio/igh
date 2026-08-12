import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireEmployeePortalPosition } from "@/lib/employee-portal";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireEmployeePortalPosition("LIMPEZA");
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const items = await prisma.inventoryItem.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      quantityOnHand: true,
      minStock: true,
      unit: true,
    },
    take: 500,
  });

  return jsonOk({
    items: items.map((item) => ({
      ...item,
      lowStock: item.quantityOnHand <= item.minStock,
    })),
  });
}
