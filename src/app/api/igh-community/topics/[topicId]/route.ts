import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { canReadCommunity, mapReplyRow, mapTopicRow, replyInclude, topicInclude } from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ topicId: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR", "TEACHER"]);
    if (!canReadCommunity(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const { topicId } = await ctx.params;
    const topic = await prisma.ighCommunityTopic.findFirst({
      where: { id: topicId, status: "APPROVED" },
      include: {
        ...topicInclude,
        _count: { select: { replies: true } },
      },
    });
    if (!topic) return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);

    const replies = await prisma.ighCommunityReply.findMany({
      where: { topicId, status: "APPROVED" },
      orderBy: { createdAt: "asc" },
      include: replyInclude,
    });

    return jsonOk({
      topic: mapTopicRow(topic, user.id),
      replies: replies.map((r) => mapReplyRow(r, user.id)),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
