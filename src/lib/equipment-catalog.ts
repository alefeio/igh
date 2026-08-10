import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DONATION_KIT,
  type DonationKitComponent,
} from "@/lib/donation-kits";

const DEFAULT_EQUIPMENT = [
  ...DEFAULT_DONATION_KIT.map((c, i) => ({
    name: c.name,
    quantityPerKit: c.quantityPerKit,
    sortOrder: i,
  })),
  { name: "Notebook", quantityPerKit: 0, sortOrder: 100 },
] as const;

/** Garante catálogo inicial (idempotente). */
export async function ensureEquipmentCatalogSeeded(actorId?: string | null) {
  const count = await prisma.equipmentCatalogItem.count({
    where: { deletedAt: null },
  });
  if (count > 0) return;

  await prisma.equipmentCatalogItem.createMany({
    data: DEFAULT_EQUIPMENT.map((e) => ({
      name: e.name,
      quantityPerKit: e.quantityPerKit,
      sortOrder: e.sortOrder,
      createdByUserId: actorId ?? null,
    })),
    skipDuplicates: true,
  });
}

export async function getKitComponentsFromCatalog(): Promise<DonationKitComponent[]> {
  await ensureEquipmentCatalogSeeded();
  const rows = await prisma.equipmentCatalogItem.findMany({
    where: { deletedAt: null, isActive: true, quantityPerKit: { gt: 0 } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, quantityPerKit: true },
  });
  if (rows.length === 0) return [...DEFAULT_DONATION_KIT];
  return rows.map((r) => ({ name: r.name, quantityPerKit: r.quantityPerKit }));
}

export function serializeEquipment(item: {
  id: string;
  name: string;
  quantityPerKit: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
