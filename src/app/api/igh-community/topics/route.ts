import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { canReadCommunity, mapTopicRow } from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Leitura da comunidade para professor e equipe (somente publicados). */
export async function GET(request: Request) {
  try {
    const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR", "TEACHER"]);
    if (!canReadCommunity(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");

    const topics = await prisma.ighCommunityTopic.findMany({
      where: {
        status: "APPROVED",
        ...(kind && ["IDEA", "TEAM", "DISCUSSION"].includes(kind)
          ? { kind: kind as "IDEA" | "TEAM" | "DISCUSSION" }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        student: { select: { name: true } },
        replies: { where: { status: "APPROVED" }, select: { id: true } },
      },
    });

    return jsonOk({
      topics: topics.map((t) => mapTopicRow({ ...t, _count: { replies: t.replies.length } }, null)),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
