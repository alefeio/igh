import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

/** Registra acesso à página de onboarding (uma linha por usuário; atualiza último acesso e contagem). */
export async function POST() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const role = user.role as UserRole;
  const now = new Date();

  await prisma.onboardingUserVisit.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      role,
      firstSeenAt: now,
      lastSeenAt: now,
      viewCount: 1,
    },
    update: {
      role,
      lastSeenAt: now,
      viewCount: { increment: 1 },
    },
  });

  return jsonOk({ recorded: true });
}
