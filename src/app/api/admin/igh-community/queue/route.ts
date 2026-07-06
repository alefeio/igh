import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  IGH_COMMUNITY_TOPIC_KIND_LABELS,
  authorRoleFromUserRole,
  authorRoleLabel,
  isCommunityModerator,
} from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);
    if (!isCommunityModerator(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const [topics, replies] = await Promise.all([
      prisma.ighCommunityTopic.findMany({
        where: q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          author: { select: { name: true, role: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      }),
      prisma.ighCommunityReply.findMany({
        where: q ? { content: { contains: q, mode: "insensitive" } } : {},
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          author: { select: { name: true, role: true } },
          topic: { select: { id: true, title: true } },
        },
      }),
    ]);

    return jsonOk({
      topics: topics.map((t) => ({
        id: t.id,
        kindLabel: IGH_COMMUNITY_TOPIC_KIND_LABELS[t.kind],
        title: t.title,
        content: t.content,
        authorName: t.author.name,
        authorRoleLabel: authorRoleLabel(authorRoleFromUserRole(t.author.role)),
        tags: t.tags.map((x) => x.tag.name),
        createdAt: t.createdAt.toISOString(),
      })),
      replies: replies.map((r) => ({
        id: r.id,
        topicId: r.topicId,
        topicTitle: r.topic.title,
        content: r.content,
        authorName: r.author.name,
        authorRoleLabel: authorRoleLabel(authorRoleFromUserRole(r.author.role)),
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
