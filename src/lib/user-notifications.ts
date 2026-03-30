import type { UserNotificationKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateUserNotificationInput = {
  userId: string;
  kind: UserNotificationKind;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  dedupeKey: string;
};

/** Cria notificação apenas se a dedupeKey ainda não existir. */
export async function createUserNotificationIfNew(input: CreateUserNotificationInput): Promise<boolean> {
  try {
    await prisma.userNotification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        linkUrl: input.linkUrl ?? null,
        dedupeKey: input.dedupeKey,
      },
    });
    return true;
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2002") return false;
    throw e;
  }
}

export async function countUnreadUserNotifications(userId: string): Promise<number> {
  return prisma.userNotification.count({
    where: { userId, readAt: null },
  });
}
