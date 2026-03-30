import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole, requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateAdminSchema } from "@/lib/validators/users";
import { createAuditLog } from "@/lib/audit";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateAdminRoleAssigned, templateCoordinatorRoleAssigned } from "@/lib/email/templates";
import { Prisma } from "@/generated/prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const adminListFilter = {
  OR: [{ role: "ADMIN" as const }, { role: "COORDINATOR" as const }, { isAdmin: true }],
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isAdmin: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await requireStaffWrite();
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = updateAdminSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.user.findFirst({
    where: { id, ...adminListFilter },
    select: userSelect,
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }
  if (existing.role === "MASTER") {
    return jsonErr("FORBIDDEN", "Contas Master não podem ser editadas nesta tela.", 403);
  }

  if (parsed.data.role !== undefined) {
    if (actor.role !== "MASTER") {
      return jsonErr("FORBIDDEN", "Apenas o Master pode alterar o perfil (Admin/Coordenador).", 403);
    }
    if (existing.role !== "ADMIN" && existing.role !== "COORDINATOR") {
      return jsonErr("FORBIDDEN", "A alteração de perfil só se aplica a contas Admin ou Coordenador.", 403);
    }
  }

  const data: {
    name?: string;
    email?: string;
    isActive?: boolean;
    role?: "ADMIN" | "COORDINATOR";
    passwordHash?: string;
    mustChangePassword?: boolean;
  } = {};

  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name.trim();
  }
  if (parsed.data.isActive !== undefined) {
    if (actor.id === id && parsed.data.isActive === false) {
      return jsonErr("INVALID_STATE", "Você não pode desativar sua própria conta.", 400);
    }
    data.isActive = parsed.data.isActive;
  }
  if (parsed.data.role !== undefined) {
    data.role = parsed.data.role;
  }

  if (parsed.data.email !== undefined) {
    const norm = parsed.data.email.toLowerCase();
    if (norm !== existing.email.toLowerCase()) {
      const taken = await prisma.user.findFirst({
        where: { email: norm, id: { not: id } },
        select: { id: true },
      });
      if (taken) {
        return jsonErr("EMAIL_IN_USE", "Já existe um usuário com este e-mail.", 409);
      }
      data.email = norm;
    }
  }

  if (parsed.data.password !== undefined && parsed.data.password !== "") {
    data.passwordHash = await hashPassword(parsed.data.password);
    data.mustChangePassword = true;
  }

  if (Object.keys(data).length === 0) {
    return jsonErr("VALIDATION_ERROR", "Nenhum dado para atualizar.", 400);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  await createAuditLog({
    entityType: "User",
    entityId: id,
    action: "USER_UPDATED",
    diff: { fields: Object.keys(data), performedBy: actor.id },
    performedByUserId: actor.id,
  });

  if (
    parsed.data.role !== undefined &&
    parsed.data.role !== existing.role &&
    actor.role === "MASTER" &&
    (parsed.data.role === "ADMIN" || parsed.data.role === "COORDINATOR") &&
    (existing.role === "ADMIN" || existing.role === "COORDINATOR")
  ) {
    const welcome =
      parsed.data.role === "COORDINATOR" && existing.role === "ADMIN"
        ? templateCoordinatorRoleAssigned({ name: updated.name, email: updated.email })
        : templateAdminRoleAssigned({ name: updated.name, email: updated.email });
    const { subject, html } = welcome;
    const emailResult = await sendEmailAndRecord({
      to: updated.email,
      subject,
      html,
      emailType:
        parsed.data.role === "COORDINATOR" ? "coordinator_role_assigned" : "admin_role_assigned",
      entityType: "User",
      entityId: id,
      performedByUserId: actor.id,
    });
    await createAuditLog({
      entityType: "User",
      entityId: id,
      action: "EMAIL_SENT",
      diff: {
        type: parsed.data.role === "COORDINATOR" ? "coordinator_role_assigned" : "admin_role_assigned",
        success: emailResult.success,
        messageId: emailResult.messageId,
      },
      performedByUserId: actor.id,
    });
  }

  return jsonOk({ user: updated });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const url = new URL(request.url);
  const permanent = url.searchParams.get("permanent") === "true";
  const actor = permanent ? await requireRole("MASTER") : await requireStaffWrite();
  const { id } = await ctx.params;

  const existing = await prisma.user.findFirst({
    where: { id, ...adminListFilter },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }
  if (existing.role === "MASTER") {
    return jsonErr("FORBIDDEN", "Contas Master não podem ser alteradas nesta tela.", 403);
  }
  if (actor.id === id) {
    return jsonErr("INVALID_STATE", "Você não pode desativar ou excluir sua própria conta.", 400);
  }

  if (permanent) {
    try {
      await prisma.user.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        return jsonErr(
          "CONSTRAINT",
          "Não é possível excluir: existem registros vinculados a este usuário.",
          409,
        );
      }
      throw e;
    }
    await createAuditLog({
      entityType: "User",
      entityId: id,
      action: "USER_DELETED",
      diff: { permanent: true, email: existing.email },
      performedByUserId: actor.id,
    });
    return jsonOk({ deleted: true });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: userSelect,
  });

  await createAuditLog({
    entityType: "User",
    entityId: id,
    action: "USER_DEACTIVATED",
    diff: { email: existing.email },
    performedByUserId: actor.id,
  });

  return jsonOk({ user: updated });
}
