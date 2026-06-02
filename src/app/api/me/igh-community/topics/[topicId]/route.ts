import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  getStudentForCommunityUser,
  IGH_COMMUNITY_STATUS_LABELS,
  mapTopicRow,
} from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ topicId: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole("STUDENT");
    const { topicId } = await ctx.params;
    const student = await getStudentForCommunityUser(user.id);
    if (!student) return jsonErr("NOT_FOUND", "Perfil de aluno não encontrado.", 404);

    const topic = await prisma.ighCommunityTopic.findUnique({
      where: { id: topicId },
      include: {
        student: { select: { name: true } },
        _count: { select: { replies: true } },
      },
    });
    if (!topic) return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);

    const isOwn = topic.studentId === student.id;
    if (topic.status !== "APPROVED" && !isOwn) {
      return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);
    }

    const replies = await prisma.ighCommunityReply.findMany({
      where: {
        topicId,
        OR: [{ status: "APPROVED" }, { studentId: student.id }],
      },
      orderBy: { createdAt: "asc" },
      include: { student: { select: { name: true } } },
    });

    return jsonOk({
      topic: mapTopicRow(topic, student.id),
      replies: replies.map((r) => ({
        id: r.id,
        content: r.content,
        status: r.status,
        statusLabel: IGH_COMMUNITY_STATUS_LABELS[r.status],
        authorName: r.student.name,
        authorStudentId: r.studentId,
        isOwn: r.studentId === student.id,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
