import "server-only";

import { prisma } from "@/lib/prisma";

const DEFAULT_AGREEMENTS = [
  { name: "MEI", sortOrder: 1 },
  { name: "CLT", sortOrder: 2 },
  { name: "Prestador", sortOrder: 3 },
  { name: "Bolsa / estágio", sortOrder: 4 },
] as const;

export async function ensurePaymentAgreementsSeeded(actorId?: string | null) {
  const count = await prisma.paymentAgreement.count({ where: { deletedAt: null } });
  if (count > 0) return;

  await prisma.paymentAgreement.createMany({
    data: DEFAULT_AGREEMENTS.map((a) => ({
      name: a.name,
      sortOrder: a.sortOrder,
      createdByUserId: actorId ?? null,
    })),
    skipDuplicates: true,
  });
}
