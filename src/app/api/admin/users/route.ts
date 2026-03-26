import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAdminSchema } from "@/lib/validators/users";
import { createAuditLog } from "@/lib/audit";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateAdminWelcome, templateCoordinatorWelcome } from "@/lib/email/templates";

export async function GET() {
  await requireRole("MASTER");

  const users = await prisma.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { role: "COORDINATOR" }, { isAdmin: true }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isAdmin: true,
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
    select: { id: true, name: true, email: true, role: true, isActive: true, isAdmin: true },
  });

  if (existing) {
    if (existing.role === "ADMIN" || existing.role === "MASTER" || existing.role === "COORDINATOR") {
      return jsonErr("EMAIL_IN_USE", "Já existe um usuário administrativo com este e-mail.", 409);
    }
    if (targetRole === "COORDINATOR") {
      return jsonErr(
        "EMAIL_IN_USE",
        "Para criar um Coordenador, use um e-mail que ainda não esteja cadastrado na plataforma.",
        409,
      );
    }
    if (existing.role === "STUDENT" || existing.role === "TEACHER") {
      if (existing.isAdmin) {
        return jsonErr("EMAIL_IN_USE", "Este usuário já possui acesso como Admin.", 409);
      }
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true, ...(name.trim() !== existing.name ? { name: name.trim() } : {}) },
        select: { id: true, name: true, email: true, role: true, isAdmin: true, isActive: true },
      });
      await createAuditLog({
        entityType: "User",
        entityId: updated.id,
        action: "ADMIN_ACCESS_GRANTED",
        diff: { email: updated.email, previousRole: existing.role },
        performedByUserId: master.id,
      });
      return jsonOk(
        {
          user: updated,
          emailSent: true,
          alreadyRegisteredAs: existing.role === "STUDENT" ? "Aluno" : "Professor",
        },
        { status: 200 }
      );
    }
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
      : templateAdminWelcome({
          name: created.name,
          email: created.email,
          tempPassword,
        });
  const { subject, html } = welcome;
  const emailResult = await sendEmailAndRecord({
    to: created.email,
    subject,
    html,
    emailType: created.role === "COORDINATOR" ? "welcome_coordinator" : "welcome_admin",
    entityType: "User",
    entityId: created.id,
    performedByUserId: master.id,
  });
  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "EMAIL_SENT",
    diff: { type: "welcome_admin", success: emailResult.success, messageId: emailResult.messageId },
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
