import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { isCommunityModerator } from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { moderateIghCommunityPostSchema } from "@/lib/validators/igh-community";

type RouteCtx = { params: Promise<{ topicId: string }> };

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);
    if (!isCommunityModerator(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const { topicId } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = moderateIghCommunityPostSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    const existing = await prisma.ighCommunityTopic.findUnique({ where: { id: topicId } });
    if (!existing) return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);

    const status = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
    const content =
      parsed.data.content !== undefined && parsed.data.content !== ""
        ? parsed.data.content
        : existing.content;

    const updated = await prisma.ighCommunityTopic.update({
      where: { id: topicId },
      data: {
        status,
        content,
        moderatedAt: new Date(),
        moderatedByUserId: user.id,
        moderationNote: parsed.data.moderationNote ?? null,
      },
    });

    return jsonOk({ topic: { id: updated.id, status: updated.status } });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
