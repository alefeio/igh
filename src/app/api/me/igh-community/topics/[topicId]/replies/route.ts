import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import {
  getStudentForCommunityUser,
  IGH_COMMUNITY_STATUS_LABELS,
  studentCanParticipateInCommunity,
} from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createIghCommunityReplySchema } from "@/lib/validators/igh-community";

type RouteCtx = { params: Promise<{ topicId: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole("STUDENT");
    const { topicId } = await ctx.params;
    const student = await getStudentForCommunityUser(user.id);
    if (!student) return jsonErr("NOT_FOUND", "Perfil de aluno não encontrado.", 404);

    if (!(await studentCanParticipateInCommunity(student.id))) {
      return jsonErr("FORBIDDEN", "É necessário ter matrícula ativa para responder.", 403);
    }

    const topic = await prisma.ighCommunityTopic.findUnique({
      where: { id: topicId },
      select: { id: true, status: true },
    });
    if (!topic || topic.status !== "APPROVED") {
      return jsonErr("FORBIDDEN", "Só é possível responder em tópicos já publicados.", 403);
    }

    const body = await request.json().catch(() => null);
    const parsed = createIghCommunityReplySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    const reply = await prisma.ighCommunityReply.create({
      data: {
        topicId,
        studentId: student.id,
        content: parsed.data.content,
        status: "PENDING",
      },
      include: { student: { select: { name: true } } },
    });

    return jsonOk(
      {
        reply: {
          id: reply.id,
          content: reply.content,
          status: reply.status,
          statusLabel: IGH_COMMUNITY_STATUS_LABELS[reply.status],
          authorName: reply.student.name,
          authorStudentId: reply.studentId,
          isOwn: true,
          createdAt: reply.createdAt.toISOString(),
        },
        message: "Sua resposta foi enviada e aguarda moderação.",
      },
      { status: 201 }
    );
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
