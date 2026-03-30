import { requireSessionUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const LIMIT = 50;

/** Lista notificações do usuário (mais recentes primeiro). */
export async function GET() {
  const user = await requireSessionUser();
  const items = await prisma.userNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
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
