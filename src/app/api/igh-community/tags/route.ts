import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { canReadCommunity } from "@/lib/igh-community";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireRole(["STUDENT", "MASTER", "ADMIN", "COORDINATOR", "TEACHER"]);
    if (!canReadCommunity(user)) return jsonErr("FORBIDDEN", "Sem permissão.", 403);

    const tags = await prisma.ighCommunityTag.findMany({
      orderBy: { name: "asc" },
      take: 200,
      select: { name: true },
    });

    return jsonOk({ tags: tags.map((t) => t.name) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
