import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

const DEFAULT_TITLE: Record<UserRole, string> = {
  MASTER: "Como usar o sistema — Master",
  ADMIN: "Como usar o sistema — Administrador",
  COORDINATOR: "Como usar o sistema — Coordenador",
  TEACHER: "Como usar o sistema — Professor",
  STUDENT: "Como usar o sistema — Aluno",
};

export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const role = user.role as UserRole;
  const row = await prisma.onboardingGuide.findUnique({
    where: { role },
    select: {
      title: true,
      contentRich: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  if (!row) {
    return jsonOk({
      role,
      title: DEFAULT_TITLE[role],
      contentRich: "",
      updatedAt: null,
      updatedByName: null,
      isEmpty: true,
    });
  }

  return jsonOk({
    role,
    title: row.title || DEFAULT_TITLE[role],
    contentRich: row.contentRich,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedBy?.name ?? null,
    isEmpty: !row.contentRich?.trim(),
  });
}
