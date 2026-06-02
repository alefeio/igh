import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { canReadCommunity, IGH_COMMUNITY_STATUS_LABELS, mapTopicRow } from "@/lib/igh-community";
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
        student: { select: { name: true } },
        replies: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "asc" },
          include: { student: { select: { name: true } } },
        },
      },
    });
    if (!topic) return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);

    return jsonOk({
      topic: mapTopicRow({ ...topic, _count: { replies: topic.replies.length } }, null),
      replies: topic.replies.map((r) => ({
        id: r.id,
        content: r.content,
        status: r.status,
        statusLabel: IGH_COMMUNITY_STATUS_LABELS[r.status],
        authorName: r.student.name,
        authorStudentId: r.studentId,
        isOwn: false,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
