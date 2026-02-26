import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateTeacherSchema } from "@/lib/validators/teachers";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.teacher.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);
  }

  const newEmail = parsed.data.email === "" ? null : (parsed.data.email ?? existing.email);
  if (newEmail && newEmail !== existing.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (emailTaken) {
      return jsonErr("EMAIL_IN_USE", "Já existe um usuário com este e-mail.", 409);
    }
  }

  const passwordToSet =
    parsed.data.password && parsed.data.password !== ""
      ? await hashPassword(parsed.data.password)
      : undefined;

  let teacherUserId: string | null = existing.userId;
  if (existing.userId && existing.user) {
    await prisma.user.update({
      where: { id: existing.userId },
      data: {
        ...(parsed.data.name != null && { name: parsed.data.name }),
        ...(newEmail != null && { email: newEmail }),
        ...(passwordToSet != null && { passwordHash: passwordToSet }),
      },
    });
  } else if (!existing.userId && newEmail && passwordToSet) {
    const createdUser = await prisma.user.create({
      data: {
        name: parsed.data.name ?? existing.name,
        email: newEmail,
        passwordHash: passwordToSet,
        role: "TEACHER",
        isActive: true,
      },
    });
    teacherUserId = createdUser.id;
  }

  const isReactivating =
    (parsed.data.isActive === true && !existing.isActive) || existing.deletedAt != null;

  const updated = await prisma.teacher.update({
    where: { id },
    data: {
      name: parsed.data.name ?? existing.name,
      phone: parsed.data.phone === "" ? null : (parsed.data.phone ?? existing.phone),
      email: newEmail ?? existing.email,
      isActive: parsed.data.isActive ?? existing.isActive,
      ...(!existing.userId && teacherUserId != null ? { userId: teacherUserId } : {}),
      ...(parsed.data.isActive === true ? { deletedAt: null } : {}),
    },
  });

  await createAuditLog({
    entityType: "Teacher",
    entityId: id,
    action: isReactivating ? "TEACHER_REACTIVATE" : "UPDATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ teacher: updated });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const existing = await prisma.teacher.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);
  }

  if (existing.deletedAt) {
    await prisma.teacher.delete({ where: { id } });
    await createAuditLog({
      entityType: "Teacher",
      entityId: id,
      action: "TEACHER_DELETE",
      diff: { before: existing },
      performedByUserId: user.id,
    });
    return jsonOk({ deleted: true });
  }

  const updated = await prisma.teacher.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await createAuditLog({
    entityType: "Teacher",
    entityId: id,
    action: "TEACHER_DEACTIVATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ teacher: updated });
}
