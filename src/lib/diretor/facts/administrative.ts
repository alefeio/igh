import "server-only";

import { missingRequiredDocuments } from "@/lib/employees";
import { cachedDirector } from "@/lib/diretor/cache";
import { inventoryStockBand } from "@/lib/diretor/metrics/admin-formulas";
import type { AdministrativeExecutiveFacts } from "@/lib/diretor/facts/types";
import { prisma } from "@/lib/prisma";

async function loadAdminFactsUncached(asOf: Date): Promise<AdministrativeExecutiveFacts> {
  const [employees, contractsExpired, items] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null, status: "ATIVO" },
      select: { employmentType: true, documents: { where: { deletedAt: null }, select: { type: true } } },
    }),
    prisma.employeeContract.count({
      where: { deletedAt: null, status: "ATIVO", kind: "CONTRATO", endDate: { lt: asOf } },
    }),
    prisma.inventoryItem.findMany({
      where: { deletedAt: null, isActive: true },
      select: { quantityOnHand: true, minStock: true },
    }),
  ]);
  let pendingDocuments = 0;
  for (const e of employees) {
    if (missingRequiredDocuments(e.employmentType, e.documents.map((d) => d.type)).length > 0) {
      pendingDocuments += 1;
    }
  }
  let inventoryZero = 0;
  let inventoryBelowMin = 0;
  for (const it of items) {
    const b = inventoryStockBand(it.quantityOnHand, it.minStock);
    if (b === "zero") inventoryZero += 1;
    else if (b === "at_or_below_min") inventoryBelowMin += 1;
  }
  return {
    contractsExpired,
    pendingDocuments,
    inventoryZero,
    inventoryBelowMin,
    stockCritical: inventoryZero + inventoryBelowMin,
    periodLabel: "estoque",
    quality: [{ domain: "administrative", status: "ok" }],
    qualityNotes: [],
  };
}

export async function loadAdministrativeExecutiveFacts(viewer: "DIRECTOR" | "MASTER", asOf = new Date()) {
  return cachedDirector(["facts-admin", viewer, asOf.toISOString().slice(0, 10)], () =>
    loadAdminFactsUncached(asOf),
  );
}
