import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  IGH_COMMUNITY_STATUS_LABELS,
  IGH_COMMUNITY_TOPIC_KIND_LABELS,
  isCommunityModerator,
} from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);
    if (!isCommunityModerator(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "PENDING";

    const validStatus = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
    if (!validStatus.includes(status as (typeof validStatus)[number])) {
      return jsonErr("VALIDATION_ERROR", "Status inválido.", 400);
    }

    const [topics, replies, pendingTopics, pendingReplies] = await Promise.all([
      prisma.ighCommunityTopic.findMany({
        where: status === "ALL" ? {} : { status: status as "PENDING" | "APPROVED" | "REJECTED" },
        orderBy: { createdAt: "desc" },
        take: 80,
        include: { student: { select: { name: true } } },
      }),
      prisma.ighCommunityReply.findMany({
        where: status === "ALL" ? {} : { status: status as "PENDING" | "APPROVED" | "REJECTED" },
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          student: { select: { name: true } },
          topic: { select: { id: true, title: true } },
        },
      }),
      prisma.ighCommunityTopic.count({ where: { status: "PENDING" } }),
      prisma.ighCommunityReply.count({ where: { status: "PENDING" } }),
    ]);

    return jsonOk({
      pendingTopics,
      pendingReplies,
      topics: topics.map((t) => ({
        id: t.id,
        kind: t.kind,
        kindLabel: IGH_COMMUNITY_TOPIC_KIND_LABELS[t.kind],
        title: t.title,
        content: t.content,
        status: t.status,
        statusLabel: IGH_COMMUNITY_STATUS_LABELS[t.status],
        authorName: t.student.name,
        createdAt: t.createdAt.toISOString(),
      })),
      replies: replies.map((r) => ({
        id: r.id,
        topicId: r.topicId,
        topicTitle: r.topic.title,
        content: r.content,
        status: r.status,
        statusLabel: IGH_COMMUNITY_STATUS_LABELS[r.status],
        authorName: r.student.name,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
