import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_CYCLE_ID } from "../../src/lib/cycles";

export async function applyCyclesV1Seed(prisma: PrismaClient) {
  await prisma.cycle.upsert({
    where: { id: DEFAULT_CYCLE_ID },
    create: {
      id: DEFAULT_CYCLE_ID,
      cycle: 1,
      year: 2026,
      isVisibleForEnrollments: true,
    },
    update: {
      cycle: 1,
      year: 2026,
      isVisibleForEnrollments: true,
    },
  });
}

