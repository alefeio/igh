import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAdminSchema } from "@/lib/validators/users";
import { createAuditLog } from "@/lib/audit";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import {
  templateAdminWelcome,
  templateCoordinatorWelcome,
  templatePoloCoordinatorWelcome,
  templateAdminRoleAssigned,
  templateCoordinatorRoleAssigned,
  templatePoloCoordinatorRoleAssigned,
} from "@/lib/email/templates";

const ROLE_LABEL_PT: Record<string, string> = {
  MASTER: "Administrador Master",
  ADMIN: "Admin",
  COORDINATOR: "Coordenador",
  POLO_COORDINATOR: "Coordenador de Polos",
  TEACHER: "Professor",
  STUDENT: "Aluno",
};

export async function GET() {
  await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: "ADMIN" },
        { role: "COORDINATOR" },
        { role: "POLO_COORDINATOR" },
        { isAdmin: true },
        { isCoordinator: true },
        { isPoloCoordinator: true },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isAdmin: true,
      isCoordinator: true,
      isPoloCoordinator: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return jsonOk({ users });
}

export async function POST(request: Request) {
  const master = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { name, email, role: targetRole = "ADMIN" } = parsed.data;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isAdmin: true,
      isCoordinator: true,
      isPoloCoordinator: true,
    },
  });

  if (existing) {
    /** O Master já possui todos os acessos administrativos. */
    if (existing.role === "MASTER") {
      return jsonErr("EMAIL_IN_USE", "Este usuário é Administrador Master e já possui todos os acessos.", 409);
    }

    /** Já detém o perfil solicitado (papel-base ou sobreposição)? Só então bloqueamos. */
    const alreadyHasTarget =
      (targetRole === "ADMIN" && (existing.isAdmin || existing.role === "ADMIN")) ||
      (targetRole === "COORDINATOR" && (existing.isCoordinator || existing.role === "COORDINATOR")) ||
      (targetRole === "POLO_COORDINATOR" &&
        (existing.isPoloCoordinator || existing.role === "POLO_COORDINATOR"));

    if (alreadyHasTarget) {
      return jsonErr("EMAIL_IN_USE", "Este usuário já possui este perfil de acesso.", 409);
    }

    /** Concede o novo perfil como sobreposição, preservando o papel-base e os perfis de aluno/professor. */
    const overlay =
      targetRole === "ADMIN"
        ? { isAdmin: true }
        : targetRole === "COORDINATOR"
          ? { isCoordinator: true }
          : { isPoloCoordinator: true };

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...overlay,
        ...(name.trim() && name.trim() !== existing.name ? { name: name.trim() } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAdmin: true,
        isCoordinator: true,
        isPoloCoordinator: true,
        isActive: true,
      },
    });
    await createAuditLog({
      entityType: "User",
      entityId: updated.id,
      action: "STAFF_ACCESS_GRANTED",
      diff: { email: updated.email, grantedRole: targetRole, previousRole: existing.role },
      performedByUserId: master.id,
    });

    const assigned =
      targetRole === "COORDINATOR"
        ? templateCoordinatorRoleAssigned({ name: updated.name, email: updated.email })
        : targetRole === "POLO_COORDINATOR"
          ? templatePoloCoordinatorRoleAssigned({ name: updated.name, email: updated.email })
          : templateAdminRoleAssigned({ name: updated.name, email: updated.email });
    const emailType =
      targetRole === "COORDINATOR"
        ? "coordinator_role_assigned"
        : targetRole === "POLO_COORDINATOR"
          ? "polo_coordinator_role_assigned"
          : "admin_role_assigned";
    const emailResult = await sendEmailAndRecord({
      to: updated.email,
      subject: assigned.subject,
      html: assigned.html,
      emailType,
      entityType: "User",
      entityId: updated.id,
      performedByUserId: master.id,
    });
    await createAuditLog({
      entityType: "User",
      entityId: updated.id,
      action: "EMAIL_SENT",
      diff: {
        type: emailType,
        success: emailResult.success,
        messageId: emailResult.messageId,
        queued: emailResult.queued ?? false,
      },
      performedByUserId: master.id,
    });

    return jsonOk(
      {
        user: updated,
        emailSent: emailResult.success,
        alreadyRegisteredAs: ROLE_LABEL_PT[existing.role] ?? existing.role,
      },
      { status: 200 }
    );
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: targetRole,
      isActive: true,
      mustChangePassword: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "USER_CREATED",
    diff: { created: { id: created.id, email: created.email, role: created.role } },
    performedByUserId: master.id,
  });

  const welcome =
    created.role === "COORDINATOR"
      ? templateCoordinatorWelcome({
          name: created.name,
          email: created.email,
          tempPassword,
        })
      : created.role === "POLO_COORDINATOR"
        ? templatePoloCoordinatorWelcome({
            name: created.name,
            email: created.email,
            tempPassword,
          })
        : templateAdminWelcome({
            name: created.name,
            email: created.email,
            tempPassword,
          });
  const { subject, html } = welcome;
  const emailType =
    created.role === "COORDINATOR"
      ? "welcome_coordinator"
      : created.role === "POLO_COORDINATOR"
        ? "welcome_polo_coordinator"
        : "welcome_admin";
  const emailResult = await sendEmailAndRecord({
    to: created.email,
    subject,
    html,
    emailType,
    entityType: "User",
    entityId: created.id,
    performedByUserId: master.id,
  });
  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "EMAIL_SENT",
    diff: {
      type: emailType,
      success: emailResult.success,
      messageId: emailResult.messageId,
    },
    performedByUserId: master.id,
  });

  return jsonOk(
    {
      user: created,
      emailSent: emailResult.success,
      ...(emailResult.success ? {} : { temporaryPassword: tempPassword }),
    },
    { status: 201 }
  );
}
