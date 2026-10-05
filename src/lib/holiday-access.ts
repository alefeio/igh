import "server-only";

import type { SessionUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth";
import { canPedagogicalAdminEditHoliday } from "@/lib/holiday-access-shared";
import { isMasterOrGeneralAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export {
  canPedagogicalAdminEditHoliday,
  isTimedHolidayEvent,
  serializeHolidayWithCreator,
} from "@/lib/holiday-access-shared";

/** Master/Admin Geral: governança plena. Admin pedagógico: só criação de eventos. */
export async function requireHolidayCreateUser(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (isMasterOrGeneralAdmin(user)) return user;
  if (user.role === "ADMIN") return user;
  throw new Error("FORBIDDEN");
}

export async function assertCanModifyHoliday(
  user: SessionUser,
  holiday: { eventStartTime?: string | null; eventEndTime?: string | null },
  createdByUserId: string | null
): Promise<void> {
  if (isMasterOrGeneralAdmin(user)) return;
  if (user.role === "ADMIN" && canPedagogicalAdminEditHoliday(user.id, holiday, createdByUserId)) {
    return;
  }
  throw new Error("FORBIDDEN");
}

/** Primeiro CREATE no audit log identifica quem cadastrou o feriado/evento. */
export async function mapHolidayCreators(holidayIds: string[]): Promise<Map<string, string | null>> {
  if (holidayIds.length === 0) return new Map();

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "Holiday",
      entityId: { in: holidayIds },
      action: "CREATE",
      performedByUserId: { not: null },
    },
    select: { entityId: true, performedByUserId: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, string | null>();
  for (const log of logs) {
    if (!map.has(log.entityId) && log.performedByUserId) {
      map.set(log.entityId, log.performedByUserId);
    }
  }
  return map;
}

export async function resolveHolidayCreator(holidayId: string): Promise<string | null> {
  const map = await mapHolidayCreators([holidayId]);
  return map.get(holidayId) ?? null;
}
