import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword, requireExactMaster } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAdminSchema } from "@/lib/validators/users";
import { birthDateInputToDate } from "@/lib/validators/person-contact";
import { maybeSendBirthdayGreetingForUser } from "@/lib/birthday-notifications";
import { createAuditLog } from "@/lib/audit";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { isExactMaster } from "@/lib/rbac";
import {
  normalizeManagedRoles,
  pickStaffBaseRole,
  staffOverlaysForBase,
  userHasStaffAccess,
  type ManagedAccessRole,
  type StaffAccessRole,
  MANAGED_ACCESS_LABEL,
} from "@/lib/staff-access";
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
  GENERAL_ADMIN: "Administrador Geral",
  ADMIN: "Admin",
  COORDINATOR: "Coordenador",
  POLO_COORDINATOR: "Coordenador de Polos",
  TEACHER: "Professor",
  STUDENT: "Aluno",
};

function assignedEmailFor(role: StaffAccessRole, name: string, email: string) {
  if (role === "COORDINATOR") {
    return {
      template: templateCoordinatorRoleAssigned({ name, email }),
      emailType: "coordinator_role_assigned" as const,
    };
  }
  if (role === "POLO_COORDINATOR") {
    return {
      template: templatePoloCoordinatorRoleAssigned({ name, email }),
      emailType: "polo_coordinator_role_assigned" as const,
    };
  }
  return {
    template: templateAdminRoleAssigned({ name, email }),
    emailType: "admin_role_assigned" as const,
  };
}

function welcomeEmailFor(role: string, name: string, email: string, tempPassword: string) {
  if (role === "COORDINATOR") {
    return {
      template: templateCoordinatorWelcome({ name, email, tempPassword }),
      emailType: "welcome_coordinator" as const,
    };
  }
  if (role === "POLO_COORDINATOR") {
    return {
      template: templatePoloCoordinatorWelcome({ name, email, tempPassword }),
      emailType: "welcome_polo_coordinator" as const,
    };
  }
  return {
    template: templateAdminWelcome({ name, email, tempPassword }),
    emailType: "welcome_admin" as const,
  };
}

export async function GET() {
  await requireRole("MASTER");

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: "GENERAL_ADMIN" },
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
      whatsapp: true,
      birthDate: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { coordinatedPolos: true } },
    },
  });

  return jsonOk({
    users: users.map((u) => ({
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
      coordinatedPoloCount: u._count.coordinatedPolos,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const actor = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const selectedRoles = normalizeManagedRoles(
    parsed.data.roles ?? (parsed.data.role ? [parsed.data.role] : undefined),
  );
  const wantsGeneralAdmin = selectedRoles.includes("GENERAL_ADMIN");
  if (wantsGeneralAdmin && !isExactMaster(actor)) {
    return jsonErr(
      "FORBIDDEN",
      "Apenas o Master pode criar o perfil Administrador Geral.",
      403,
    );
  }

  const { name, email, phone, birthDate } = parsed.data;
  const birthDateValue = birthDateInputToDate(birthDate);
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
    if (existing.role === "MASTER") {
      return jsonErr("EMAIL_IN_USE", "Este usuário é Administrador Master e já possui todos os acessos.", 409);
    }
    if (existing.role === "GENERAL_ADMIN") {
      return jsonErr(
        "EMAIL_IN_USE",
        "Este usuário já é Administrador Geral. Somente o Master pode alterar esse perfil.",
        409,
      );
    }
    if (wantsGeneralAdmin) {
      return jsonErr(
        "VALIDATION_ERROR",
        "Para promover a Administrador Geral, edite o usuário na listagem (somente Master).",
        400,
      );
    }

    const staffSelected = selectedRoles.filter((r): r is StaffAccessRole => r !== "GENERAL_ADMIN");
    const newlyGranted = staffSelected.filter((r) => !userHasStaffAccess(existing, r));
    if (newlyGranted.length === 0) {
      return jsonErr("EMAIL_IN_USE", "Este usuário já possui todos os perfis de acesso selecionados.", 409);
    }

    const finalOverlay = {
      isAdmin: existing.isAdmin || (newlyGranted.includes("ADMIN") && existing.role !== "ADMIN"),
      isCoordinator:
        existing.isCoordinator || (newlyGranted.includes("COORDINATOR") && existing.role !== "COORDINATOR"),
      isPoloCoordinator:
        existing.isPoloCoordinator ||
        (newlyGranted.includes("POLO_COORDINATOR") && existing.role !== "POLO_COORDINATOR"),
    };

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...finalOverlay,
        ...(name.trim() && name.trim() !== existing.name ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { whatsapp: phone } : {}),
        ...(birthDate !== undefined ? { birthDate: birthDateValue } : {}),
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
        whatsapp: true,
        birthDate: true,
      },
    });
    await createAuditLog({
      entityType: "User",
      entityId: updated.id,
      action: "STAFF_ACCESS_GRANTED",
      diff: { email: updated.email, grantedRoles: newlyGranted, previousRole: existing.role },
      performedByUserId: actor.id,
    });

    for (const granted of newlyGranted) {
      const assigned = assignedEmailFor(granted, updated.name, updated.email);
      const emailResult = await sendEmailAndRecord({
        to: updated.email,
        subject: assigned.template.subject,
        html: assigned.template.html,
        emailType: assigned.emailType,
        entityType: "User",
        entityId: updated.id,
        performedByUserId: actor.id,
      });
      await createAuditLog({
        entityType: "User",
        entityId: updated.id,
        action: "EMAIL_SENT",
        diff: {
          type: assigned.emailType,
          success: emailResult.success,
          messageId: emailResult.messageId,
          queued: emailResult.queued ?? false,
        },
        performedByUserId: actor.id,
      });
    }

    if (birthDate !== undefined) {
      await maybeSendBirthdayGreetingForUser(updated.id);
    }

    return jsonOk(
      {
        user: updated,
        emailSent: true,
        alreadyRegisteredAs: ROLE_LABEL_PT[existing.role] ?? existing.role,
        grantedRoles: newlyGranted,
        grantedLabels: newlyGranted.map((r) => MANAGED_ACCESS_LABEL[r]),
      },
      { status: 200 },
    );
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  let createData: {
    name: string;
    email: string;
    passwordHash: string;
    role: "GENERAL_ADMIN" | StaffAccessRole;
    isAdmin?: boolean;
    isCoordinator?: boolean;
    isPoloCoordinator?: boolean;
    isActive: boolean;
    mustChangePassword: boolean;
    whatsapp?: string | null;
    birthDate?: Date | null;
  };

  if (wantsGeneralAdmin) {
    await requireExactMaster();
    createData = {
      name,
      email,
      passwordHash,
      role: "GENERAL_ADMIN",
      isAdmin: false,
      isCoordinator: false,
      isPoloCoordinator: false,
      isActive: true,
      mustChangePassword: true,
      whatsapp: phone,
      birthDate: birthDateValue,
    };
  } else {
    const staffRoles = selectedRoles as StaffAccessRole[];
    const baseRole = pickStaffBaseRole(staffRoles);
    const overlays = staffOverlaysForBase(staffRoles, baseRole);
    createData = {
      name,
      email,
      passwordHash,
      role: baseRole,
      ...overlays,
      isActive: true,
      mustChangePassword: true,
      whatsapp: phone,
      birthDate: birthDateValue,
    };
  }

  const created = await prisma.user.create({
    data: createData,
    select: {
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
    },
  });

  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "USER_CREATED",
    diff: {
      created: {
        id: created.id,
        email: created.email,
        role: created.role,
        roles: selectedRoles,
      },
    },
    performedByUserId: actor.id,
  });

  const welcome = welcomeEmailFor(created.role, created.name, created.email, tempPassword);
  const emailResult = await sendEmailAndRecord({
    to: created.email,
    subject: welcome.template.subject,
    html: welcome.template.html,
    emailType: welcome.emailType,
    entityType: "User",
    entityId: created.id,
    performedByUserId: actor.id,
  });
  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "EMAIL_SENT",
    diff: {
      type: welcome.emailType,
      success: emailResult.success,
      messageId: emailResult.messageId,
    },
    performedByUserId: actor.id,
  });

  await maybeSendBirthdayGreetingForUser(created.id);

  return jsonOk(
    {
      user: created,
      emailSent: emailResult.success,
      ...(emailResult.success ? {} : { temporaryPassword: tempPassword }),
    },
    { status: 201 },
  );
}
