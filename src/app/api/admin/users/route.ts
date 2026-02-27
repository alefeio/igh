import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAdminSchema } from "@/lib/validators/users";
import { createAuditLog } from "@/lib/audit";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateAdminWelcome } from "@/lib/email/templates";

export async function GET() {
  await requireRole("MASTER");

  const users = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
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

  const { name, email } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return jsonErr("EMAIL_IN_USE", "Já existe um usuário com este e-mail.", 409);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
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

  const { subject, html } = templateAdminWelcome({
    name: created.name,
    email: created.email,
    tempPassword,
  });
  const emailResult = await sendEmailAndRecord({
    to: created.email,
    subject,
    html,
    emailType: "welcome_admin",
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
    { user: created, emailSent: emailResult.success },
    { status: 201 }
  );
}
