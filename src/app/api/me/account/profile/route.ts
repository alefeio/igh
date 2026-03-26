import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateMeAccountSchema } from "@/lib/validators/me-account";

const STAFF_ROLES = ["MASTER", "ADMIN", "TEACHER"] as const;

function isStaffRole(role: string): role is (typeof STAFF_ROLES)[number] {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** Perfil da conta para edição em Meus dados (Master, Admin, Professor). */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user || !isStaffRole(user.role)) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const db = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      role: true,
    },
  });

  if (!db) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, name: true, phone: true, email: true, photoUrl: true },
  });

  return jsonOk({
    name: db.name,
    email: db.email,
    role: db.role,
    teacher: teacher
      ? {
          id: teacher.id,
          name: teacher.name,
          phone: teacher.phone,
          email: teacher.email,
          photoUrl: teacher.photoUrl,
        }
      : null,
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user || !isStaffRole(user.role)) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMeAccountSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, role: true },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }

  const emailNorm = data.email.trim().toLowerCase();
  if (emailNorm !== existing.email.toLowerCase()) {
    const taken = await prisma.user.findFirst({
      where: { email: emailNorm, id: { not: user.id } },
      select: { id: true },
    });
    if (taken) {
      return jsonErr("EMAIL_IN_USE", "Este e-mail já está em uso por outra conta.", 409);
    }
  }

  const nameTrim = data.name.trim();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { name: nameTrim, email: emailNorm },
    });

    if (existing.role === "TEACHER") {
      const teacher = await tx.teacher.findFirst({
        where: { userId: user.id, deletedAt: null },
      });
      if (teacher) {
        await tx.teacher.update({
          where: { id: teacher.id },
          data: {
            name: nameTrim,
            email: emailNorm,
            phone: data.phone?.trim() ? data.phone.trim() : null,
          },
        });
      }
    }
  });

  return jsonOk({
    name: nameTrim,
    email: emailNorm,
    role: existing.role,
  });
}
