import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { isCommunityModerator } from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ topicId: string }> };

export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);
    if (!isCommunityModerator(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const { topicId } = await ctx.params;
    const existing = await prisma.ighCommunityTopic.findUnique({ where: { id: topicId } });
    if (!existing) return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);

    await prisma.ighCommunityTopic.delete({ where: { id: topicId } });
    return jsonOk({ deleted: true });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
