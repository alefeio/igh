import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Aceites gravados para o usuário logado (comparar com GET /api/legal/current). */
export async function GET() {
  const user = await getSessionUserFromCookie();

  if (!user) {
    return jsonOk({ authenticated: false as const, acceptance: null as null });
  }

  const row = await prisma.userLegalAcceptance.findUnique({
    where: { userId: user.id },
    select: {
      termsVersionId: true,
      privacyVersionId: true,
      cookieVersionId: true,
      acceptedAt: true,
    },
  });

  return jsonOk({
    authenticated: true as const,
    acceptance: row
      ? {
          termsVersionId: row.termsVersionId,
          privacyVersionId: row.privacyVersionId,
          cookieVersionId: row.cookieVersionId,
          acceptedAt: row.acceptedAt.toISOString(),
        }
      : null,
  });
}
