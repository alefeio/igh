import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { mapReplyRow, replyInclude, userCanReplyAsStaff } from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createIghCommunityReplySchema } from "@/lib/validators/igh-community";

type RouteCtx = { params: Promise<{ topicId: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR", "TEACHER"]);
    if (!userCanReplyAsStaff(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const { topicId } = await ctx.params;
    const topic = await prisma.ighCommunityTopic.findFirst({
      where: { id: topicId, status: "APPROVED" },
      select: { id: true },
    });
    if (!topic) return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);

    const body = await request.json().catch(() => null);
    const parsed = createIghCommunityReplySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    const reply = await prisma.ighCommunityReply.create({
      data: {
        topicId,
        authorUserId: user.id,
        content: parsed.data.content,
        status: "APPROVED",
      },
      include: replyInclude,
    });

    return jsonOk(
      {
        reply: mapReplyRow(reply, user.id),
        message: "Resposta publicada.",
      },
      { status: 201 }
    );
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
