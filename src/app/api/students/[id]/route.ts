import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateStudentSchema } from "@/lib/validators/students";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }
  return jsonOk({ student });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  if (body?.reactivate === true && user.role === "MASTER") {
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
    }
    if (!existing.deletedAt) {
      return jsonOk({ student: existing });
    }
    const updated = await prisma.student.update({
      where: { id },
      data: { deletedAt: null, deletedByUserId: null },
    });
    await createAuditLog({
      entityType: "Student",
      entityId: id,
      action: "STUDENT_UPDATE",
      diff: { before: existing, after: updated, reactivated: true },
      performedByUserId: user.id,
    });
    return jsonOk({ student: updated });
  }

  const parsed = updateStudentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const data = parsed.data;
  if (data.cpf != null && data.cpf !== existing.cpf) {
    const duplicate = await prisma.student.findUnique({
      where: { cpf: data.cpf },
      select: { id: true },
    });
    if (duplicate) {
      return jsonErr("DUPLICATE_CPF", "Já existe um aluno com este CPF.", 409);
    }
  }

  const newEmail = data.email !== undefined ? (data.email?.trim() ? data.email.trim() : null) : existing.email;
  if (newEmail && newEmail !== existing.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (emailTaken) {
      return jsonErr("EMAIL_IN_USE", "Já existe um usuário com este e-mail.", 409);
    }
  }

  const birthDate = data.birthDate != null ? new Date(data.birthDate) : undefined;
  const updateData = {
    ...(data.name != null && { name: data.name }),
    ...(birthDate != null && { birthDate }),
    ...(data.cpf != null && { cpf: data.cpf }),
    ...(data.rg != null && { rg: data.rg }),
    ...(data.email !== undefined && { email: data.email?.trim() ? data.email.trim() : null }),
    ...(data.phone != null && { phone: data.phone }),
    ...(data.cep !== undefined && { cep: data.cep?.trim() ? data.cep.replace(/\D/g, "") : null }),
    ...(data.street != null && { street: data.street }),
    ...(data.number != null && { number: data.number }),
    ...(data.complement !== undefined && { complement: data.complement ?? null }),
    ...(data.neighborhood != null && { neighborhood: data.neighborhood }),
    ...(data.city != null && { city: data.city }),
    ...(data.state != null && { state: data.state }),
    ...(data.gender != null && { gender: data.gender }),
    ...(data.hasDisability != null && { hasDisability: data.hasDisability }),
    ...(data.disabilityDescription !== undefined && {
      disabilityDescription: data.disabilityDescription || null,
    }),
    ...(data.educationLevel != null && { educationLevel: data.educationLevel }),
    ...(data.isStudying != null && { isStudying: data.isStudying }),
    ...(data.studyShift !== undefined && {
      studyShift: data.studyShift ?? null,
    }),
    ...(data.guardianName !== undefined && { guardianName: data.guardianName ?? null }),
    ...(data.guardianCpf !== undefined && { guardianCpf: data.guardianCpf ?? null }),
    ...(data.guardianRg !== undefined && { guardianRg: data.guardianRg ?? null }),
    ...(data.guardianPhone !== undefined && { guardianPhone: data.guardianPhone ?? null }),
    ...(data.guardianRelationship !== undefined && {
      guardianRelationship: data.guardianRelationship ?? null,
    }),
  };

  const updated = await prisma.student.update({
    where: { id },
    data: updateData,
  });

  const cpfForPassword = updated.cpf;
  if (updated.email) {
    const passwordHash = await hashPassword(cpfForPassword);
    if (existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: {
          name: updated.name,
          email: updated.email,
          passwordHash,
          isActive: true,
        },
      });
    } else {
      const createdUser = await prisma.user.create({
        data: {
          name: updated.name,
          email: updated.email,
          passwordHash,
          role: "STUDENT",
          isActive: true,
        },
      });
      await prisma.student.update({
        where: { id },
        data: { userId: createdUser.id },
      });
      (updated as { userId: string | null }).userId = createdUser.id;
    }
  } else if (existing.userId) {
    await prisma.user.update({
      where: { id: existing.userId },
      data: { isActive: false },
    });
    await prisma.student.update({
      where: { id },
      data: { userId: null },
    });
    (updated as { userId: string | null }).userId = null;
  }

  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(updateData) as (keyof typeof updateData)[]) {
    const before = (existing as Record<string, unknown>)[key];
    const after = (updated as Record<string, unknown>)[key];
    if (before !== after) {
      diff[key] = { before, after };
    }
  }

  await createAuditLog({
    entityType: "Student",
    entityId: id,
    action: "STUDENT_UPDATE",
    diff: Object.keys(diff).length ? diff : { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ student: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }
  if (existing.deletedAt) {
    return jsonOk({ student: existing });
  }

  const updated = await prisma.student.update({
    where: { id },
    data: { deletedAt: new Date(), deletedByUserId: user.id },
  });

  await createAuditLog({
    entityType: "Student",
    entityId: id,
    action: "STUDENT_SOFT_DELETE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ student: updated });
}
