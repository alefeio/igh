import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateTeacherSchema } from "@/lib/validators/teachers";
import { createAuditLog } from "@/lib/audit";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateProfessorWelcome, templateAddedAsProfessor } from "@/lib/email/templates";

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
  let teacherUserId: string | null = existing.userId;
  let linkedToExistingUser = false;

  if (newEmail && newEmail !== existing.email) {
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true, name: true },
    });
    if (existingUserByEmail) {
      const otherTeacher = await prisma.teacher.findFirst({
        where: { userId: existingUserByEmail.id, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (otherTeacher) {
        return jsonErr("ALREADY_TEACHER", "Este usuário já está cadastrado como professor.", 409);
      }
      teacherUserId = existingUserByEmail.id;
      linkedToExistingUser = true;
      const { subject, html } = templateAddedAsProfessor({
        name: existingUserByEmail.name,
        email: newEmail,
      });
      await sendEmailAndRecord({
        to: newEmail,
        subject,
        html,
        emailType: "added_as_professor",
        entityType: "Teacher",
        entityId: id,
        performedByUserId: user.id,
      });
    } else if (existing.userId && existing.user) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: {
          ...(parsed.data.name != null && { name: parsed.data.name }),
          email: newEmail,
        },
      });
    } else {
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      const createdUser = await prisma.user.create({
        data: {
          name: parsed.data.name ?? existing.name,
          email: newEmail,
          passwordHash,
          role: "TEACHER",
          isActive: true,
          mustChangePassword: true,
        },
      });
      teacherUserId = createdUser.id;
      const { subject, html } = templateProfessorWelcome({
        name: existing.name,
        email: newEmail,
        tempPassword,
      });
      await sendEmailAndRecord({
        to: newEmail,
        subject,
        html,
        emailType: "welcome_professor",
        entityType: "Teacher",
        entityId: id,
        performedByUserId: user.id,
      });
    }
  } else if (!linkedToExistingUser && existing.userId && existing.user && parsed.data.name != null) {
    await prisma.user.update({
      where: { id: existing.userId },
      data: { name: parsed.data.name },
    });
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
      ...(parsed.data.photoUrl !== undefined
        ? { photoUrl: parsed.data.photoUrl.trim() === "" ? null : parsed.data.photoUrl.trim() }
        : {}),
      ...(teacherUserId != null ? { userId: teacherUserId } : {}),
      ...(parsed.data.isActive === true ? { deletedAt: null } : {}),
    },
  });

  if (isReactivating && teacherUserId) {
    await prisma.user.update({
      where: { id: teacherUserId },
      data: { isActive: true },
    });
  }

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
    const linkedCount = await prisma.classGroup.count({
      where: { teacherId: id },
    });
    if (linkedCount > 0) {
      return jsonErr(
        "CONSTRAINT_VIOLATION",
        "Este professor está vinculado a turmas. Atribua outro professor às turmas antes de excluir definitivamente.",
        409
      );
    }
    const userIdToDelete = existing.userId;
    await prisma.teacher.delete({ where: { id } });
    if (userIdToDelete) {
      await prisma.user.delete({ where: { id: userIdToDelete } });
    }
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

  if (existing.userId) {
    await prisma.user.update({
      where: { id: existing.userId },
      data: { isActive: false },
    });
  }

  await createAuditLog({
    entityType: "Teacher",
    entityId: id,
    action: "TEACHER_DEACTIVATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ teacher: updated });
}
