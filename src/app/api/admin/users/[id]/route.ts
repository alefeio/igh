import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole, requireStaffWrite, requireExactMaster } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateAdminSchema } from "@/lib/validators/users";
import { birthDateInputToDate } from "@/lib/validators/person-contact";
import { maybeSendBirthdayGreetingForUser } from "@/lib/birthday-notifications";
import { createAuditLog } from "@/lib/audit";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateAdminRoleAssigned, templateCoordinatorRoleAssigned } from "@/lib/email/templates";
import { Prisma } from "@/generated/prisma/client";
import { isExactMaster } from "@/lib/rbac";
import {
  normalizeManagedRoles,
  resolveStaffAccessUpdate,
  managedRolesFromUser,
  type ManagedAccessRole,
  type StaffAccessRole,
} from "@/lib/staff-access";

type Ctx = { params: Promise<{ id: string }> };

const adminListFilter = {
  OR: [
    { role: "GENERAL_ADMIN" as const },
    { role: "ADMIN" as const },
    { role: "COORDINATOR" as const },
    { role: "POLO_COORDINATOR" as const },
    { isAdmin: true },
    { isCoordinator: true },
    { isPoloCoordinator: true },
  ],
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isAdmin: true,
  isCoordinator: true,
  isPoloCoordinator: true,
  isActive: true,
  whatsapp: true,
  birthDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

function mapUser(u: {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isCoordinator: boolean;
  isPoloCoordinator: boolean;
  isActive: boolean;
  whatsapp: string | null;
  birthDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isAdmin: u.isAdmin,
    isCoordinator: u.isCoordinator,
    isPoloCoordinator: u.isPoloCoordinator,
    isActive: u.isActive,
    phone: u.whatsapp,
    birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await requireRole("MASTER");
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
  if (existing.role === "GENERAL_ADMIN" && !isExactMaster(actor)) {
    return jsonErr("FORBIDDEN", "Somente o Master pode editar o perfil Administrador Geral.", 403);
  }

  const selectedRoles: ManagedAccessRole[] | undefined =
    parsed.data.roles !== undefined
      ? normalizeManagedRoles(parsed.data.roles)
      : parsed.data.role !== undefined
        ? normalizeManagedRoles([parsed.data.role])
        : undefined;

  if (selectedRoles?.includes("GENERAL_ADMIN") && !isExactMaster(actor)) {
    return jsonErr("FORBIDDEN", "Apenas o Master pode atribuir o perfil Administrador Geral.", 403);
  }

  const data: {
    name?: string;
    email?: string;
    isActive?: boolean;
    role?: "GENERAL_ADMIN" | StaffAccessRole;
    isAdmin?: boolean;
    isCoordinator?: boolean;
    isPoloCoordinator?: boolean;
    passwordHash?: string;
    mustChangePassword?: boolean;
    whatsapp?: string | null;
    birthDate?: Date | null;
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
  if (selectedRoles !== undefined) {
    if (selectedRoles.includes("GENERAL_ADMIN")) {
      await requireExactMaster();
      data.role = "GENERAL_ADMIN";
      data.isAdmin = false;
      data.isCoordinator = false;
      data.isPoloCoordinator = false;
    } else {
      const staffSelected = selectedRoles as StaffAccessRole[];
      if (existing.role === "GENERAL_ADMIN") {
        // Master rebaixando Admin Geral para staff
        await requireExactMaster();
        const access = resolveStaffAccessUpdate("ADMIN", staffSelected);
        data.role = access.role ?? "ADMIN";
        data.isAdmin = access.isAdmin;
        data.isCoordinator = access.isCoordinator;
        data.isPoloCoordinator = access.isPoloCoordinator;
      } else {
        const access = resolveStaffAccessUpdate(existing.role, staffSelected);
        if (access.role !== undefined) data.role = access.role;
        data.isAdmin = access.isAdmin;
        data.isCoordinator = access.isCoordinator;
        data.isPoloCoordinator = access.isPoloCoordinator;
      }
    }
  }
  if (parsed.data.phone !== undefined) {
    data.whatsapp = parsed.data.phone;
  }
  if (parsed.data.birthDate !== undefined) {
    data.birthDate = birthDateInputToDate(parsed.data.birthDate);
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

  const previousRoles = managedRolesFromUser(existing);
  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  await createAuditLog({
    entityType: "User",
    entityId: id,
    action: "USER_UPDATED",
    diff: {
      fields: Object.keys(data),
      performedBy: actor.id,
      ...(selectedRoles ? { previousRoles, nextRoles: managedRolesFromUser(updated) } : {}),
    },
    performedByUserId: actor.id,
  });

  if (selectedRoles !== undefined) {
    const newlyGranted = selectedRoles.filter((r) => !previousRoles.includes(r) && r !== "GENERAL_ADMIN");
    for (const role of newlyGranted) {
      if (role !== "ADMIN" && role !== "COORDINATOR") continue;
      const welcome =
        role === "COORDINATOR"
          ? templateCoordinatorRoleAssigned({ name: updated.name, email: updated.email })
          : templateAdminRoleAssigned({ name: updated.name, email: updated.email });
      const emailResult = await sendEmailAndRecord({
        to: updated.email,
        subject: welcome.subject,
        html: welcome.html,
        emailType: role === "COORDINATOR" ? "coordinator_role_assigned" : "admin_role_assigned",
        entityType: "User",
        entityId: id,
        performedByUserId: actor.id,
      });
      await createAuditLog({
        entityType: "User",
        entityId: id,
        action: "EMAIL_SENT",
        diff: {
          type: role === "COORDINATOR" ? "coordinator_role_assigned" : "admin_role_assigned",
          success: emailResult.success,
          messageId: emailResult.messageId,
        },
        performedByUserId: actor.id,
      });
    }
  }

  if (parsed.data.birthDate !== undefined) {
    await maybeSendBirthdayGreetingForUser(id);
  }

  return jsonOk({ user: mapUser(updated) });
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
  if (existing.role === "GENERAL_ADMIN" && !isExactMaster(actor)) {
    return jsonErr("FORBIDDEN", "Somente o Master pode excluir ou desativar Administrador Geral.", 403);
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
