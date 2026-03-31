import { requireSessionUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const MAX_LIMIT = 50;

/** Lista notificações do usuário (mais recentes primeiro). Query: `unread=1` só não lidas; `limit` (1–50). */
export async function GET(request: Request) {
  const user = await requireSessionUser();
  const { searchParams } = new URL(request.url);
  const unreadOnly =
    searchParams.get("unread") === "1" || searchParams.get("unreadOnly") === "true";
  const limitRaw = parseInt(searchParams.get("limit") ?? "", 10);
  const take = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : MAX_LIMIT;

  const items = await prisma.userNotification.findMany({
    where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
  });

  return jsonOk({
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

/** Marca todas como lidas. */
export async function PATCH() {
  const user = await requireSessionUser();
  const now = new Date();
  const result = await prisma.userNotification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: now },
  });
  return jsonOk({ updated: result.count });
}
