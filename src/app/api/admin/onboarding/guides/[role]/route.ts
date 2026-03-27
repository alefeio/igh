import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";
import { z } from "zod";

const ROLES: UserRole[] = ["MASTER", "ADMIN", "COORDINATOR", "TEACHER", "STUDENT"];

const putSchema = z.object({
  title: z.string().max(500),
  contentRich: z.string().max(2_000_000),
});

export async function GET(_request: Request, ctx: { params: Promise<{ role: string }> }) {
  await requireRole(["MASTER", "ADMIN"]);
  const { role: roleParam } = await ctx.params;
  if (!ROLES.includes(roleParam as UserRole)) {
    return jsonErr("VALIDATION_ERROR", "Perfil inválido.", 400);
  }
  const role = roleParam as UserRole;

  const row = await prisma.onboardingGuide.findUnique({
    where: { role },
    select: {
      title: true,
      contentRich: true,
      updatedAt: true,
      updatedBy: { select: { name: true, email: true } },
    },
  });

  return jsonOk({
    guide: row ?? { title: "", contentRich: "", updatedAt: null, updatedBy: null },
  });
}

export async function PUT(request: Request, ctx: { params: Promise<{ role: string }> }) {
  const user = await requireRole(["MASTER", "ADMIN"]);
  const { role: roleParam } = await ctx.params;
  if (!ROLES.includes(roleParam as UserRole)) {
    return jsonErr("VALIDATION_ERROR", "Perfil inválido.", 400);
  }
  const role = roleParam as UserRole;

  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { title, contentRich } = parsed.data;

  const saved = await prisma.onboardingGuide.upsert({
    where: { role },
    create: {
      role,
      title,
      contentRich,
      updatedById: user.id,
    },
    update: {
      title,
      contentRich,
      updatedById: user.id,
    },
    select: {
      role: true,
      title: true,
      contentRich: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  return jsonOk({ guide: saved });
}
