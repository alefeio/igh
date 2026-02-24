import "server-only";

import { prisma } from "@/lib/prisma";
import type { AuditLog } from "@/generated/prisma/client";

interface CreateAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  diff: unknown;
  performedByUserId?: string | null;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const { entityType, entityId, action, diff, performedByUserId } = input;

  return prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      diffJson: JSON.stringify(diff ?? {}),
      performedByUserId: performedByUserId ?? undefined,
    },
  });
}
