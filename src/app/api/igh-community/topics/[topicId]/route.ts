import { getSessionUserFromCookie } from "@/lib/auth";
import {
  getCommunityViewerCapabilities,
  mapReplyRow,
  mapTopicRow,
  replyInclude,
  topicInclude,
} from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ topicId: string }> };

/** Detalhe público de um tópico aprovado. */
export async function GET(_request: Request, ctx: RouteCtx) {
  const user = await getSessionUserFromCookie();
  const caps = getCommunityViewerCapabilities(user);
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
    viewer: caps,
    topic: mapTopicRow(topic, user?.id ?? null),
    replies: replies.map((r) => mapReplyRow(r, user?.id ?? null)),
  });
}
