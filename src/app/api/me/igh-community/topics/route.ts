import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  getStudentForCommunityUser,
  mapTopicRow,
  topicInclude,
  upsertCommunityTags,
  userCanParticipateInCommunity,
} from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createIghCommunityTopicSchema } from "@/lib/validators/igh-community";

export async function GET(request: Request) {
  try {
    const user = await requireRole("STUDENT");
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const tag = searchParams.get("tag")?.trim().toLowerCase();

    const topics = await prisma.ighCommunityTopic.findMany({
      where: {
        status: "APPROVED",
        ...(kind && ["IDEA", "TEAM", "DISCUSSION"].includes(kind)
          ? { kind: kind as "IDEA" | "TEAM" | "DISCUSSION" }
          : {}),
        ...(tag
          ? {
              tags: {
                some: { tag: { name: tag } },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        ...topicInclude,
        replies: { where: { status: "APPROVED" }, select: { id: true } },
      },
      take: 100,
    });

    return jsonOk({
      canParticipate: userCanParticipateInCommunity(user),
      topics: topics.map((t) =>
        mapTopicRow({ ...t, _count: { replies: t.replies.length } }, user.id)
      ),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("STUDENT");
    if (!userCanParticipateInCommunity(user)) {
      return jsonErr("FORBIDDEN", "Sua conta não está ativa para publicar na comunidade.", 403);
    }

    const body = await request.json().catch(() => null);
    const parsed = createIghCommunityTopicSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    const student = await getStudentForCommunityUser(user.id);
    const tags = await upsertCommunityTags(parsed.data.tags);

    const topic = await prisma.ighCommunityTopic.create({
      data: {
        authorUserId: user.id,
        studentId: student?.id ?? null,
        kind: parsed.data.kind,
        title: parsed.data.title,
        content: parsed.data.content,
        status: "APPROVED",
        tags: {
          create: tags.map((tag) => ({ tagId: tag.id })),
        },
      },
      include: {
        ...topicInclude,
        replies: { select: { id: true } },
      },
    });

    return jsonOk(
      {
        topic: mapTopicRow({ ...topic, _count: { replies: topic.replies.length } }, user.id),
        message: "Publicação criada com sucesso.",
      },
      { status: 201 }
    );
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
