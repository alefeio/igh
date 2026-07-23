import { prisma } from "@/lib/prisma";
import { requireRole, requireStaffWrite, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createTeacherSchema } from "@/lib/validators/teachers";
import { birthDateInputToDate } from "@/lib/validators/person-contact";
import { maybeSendBirthdayGreetingForUser } from "@/lib/birthday-notifications";
import { createAuditLog } from "@/lib/audit";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateProfessorWelcome, templateAddedAsProfessor } from "@/lib/email/templates";

export async function GET(request: Request) {
  await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "active"; // active | inactive | all

  const where =
    statusFilter === "active"
      ? { deletedAt: null }
      : statusFilter === "inactive"
        ? { deletedAt: { not: null } }
        : {};

  const teachersRaw = await prisma.teacher.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { birthDate: true, whatsapp: true } },
    },
  });

  const teachers = teachersRaw.map((t) => {
    const { user, ...rest } = t;
    return {
      ...rest,
      phone: rest.phone || user?.whatsapp || null,
      birthDate: user?.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    };
  });

  return jsonOk({ teachers });
}

export async function POST(request: Request) {
  const user = await requireStaffWrite();

  const body = await request.json().catch(() => null);
  const parsed = createTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  const phoneDigits = parsed.data.phone?.replace(/\D/g, "") || null;
  const birthDateValue = birthDateInputToDate(parsed.data.birthDate);

  let teacher: { id: string; name: string; email: string | null; userId: string | null; [key: string]: unknown };
  let emailSent = false;

  let linkedToExistingUser = false;
  if (existingUser) {
    const existingTeacher = await prisma.teacher.findFirst({
      where: { userId: existingUser.id, deletedAt: null },
      select: { id: true },
    });
    if (existingTeacher) {
      return jsonErr("ALREADY_TEACHER", "Este usuário já está cadastrado como professor.", 409);
    }
    // Multi-perfil: permite vincular perfil de professor a usuário que já possui outro perfil (aluno ou admin).
    teacher = await prisma.teacher.create({
      data: {
        name: parsed.data.name,
        phone: phoneDigits,
        email: parsed.data.email,
        photoUrl: parsed.data.photoUrl?.trim() || null,
        signatureUrl: parsed.data.signatureUrl?.trim() || null,
        isActive: true,
        userId: existingUser.id,
      },
    });
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        ...(phoneDigits ? { whatsapp: phoneDigits } : {}),
        ...(birthDateValue ? { birthDate: birthDateValue } : parsed.data.birthDate === null ? { birthDate: null } : {}),
      },
    });
    linkedToExistingUser = true;
    const { subject, html } = templateAddedAsProfessor({ name: teacher.name, email: parsed.data.email });
    const emailResult = await sendEmailAndRecord({
      to: parsed.data.email,
      subject,
      html,
      emailType: "added_as_professor",
      entityType: "Teacher",
      entityId: teacher.id,
      performedByUserId: user.id,
    });
    emailSent = emailResult.success;
    await createAuditLog({
      entityType: "Teacher",
      entityId: teacher.id,
      action: "EMAIL_SENT",
      diff: { type: "added_as_professor", success: emailResult.success },
      performedByUserId: user.id,
    });
  } else {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const createdUser = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "TEACHER",
        isActive: true,
        mustChangePassword: true,
        whatsapp: phoneDigits,
        birthDate: birthDateValue,
      },
    });
    teacher = await prisma.teacher.create({
      data: {
        name: parsed.data.name,
        phone: phoneDigits,
        email: parsed.data.email,
        photoUrl: parsed.data.photoUrl?.trim() || null,
        signatureUrl: parsed.data.signatureUrl?.trim() || null,
        isActive: true,
        userId: createdUser.id,
      },
    });
    const { subject, html } = templateProfessorWelcome({
      name: teacher.name,
      email: teacher.email!,
      tempPassword,
    });
    const emailResult = await sendEmailAndRecord({
      to: teacher.email!,
      subject,
      html,
      emailType: "welcome_professor",
      entityType: "Teacher",
      entityId: teacher.id,
      performedByUserId: user.id,
    });
    emailSent = emailResult.success;
    await createAuditLog({
      entityType: "Teacher",
      entityId: teacher.id,
      action: "EMAIL_SENT",
      diff: { type: "welcome_professor", success: emailResult.success },
      performedByUserId: user.id,
    });
  }

  await createAuditLog({
    entityType: "Teacher",
    entityId: teacher.id,
    action: "CREATE",
    diff: { after: teacher },
    performedByUserId: user.id,
  });

  if (teacher.userId) {
    await maybeSendBirthdayGreetingForUser(teacher.userId);
  }

  return jsonOk({ teacher, emailSent, linkedToExistingUser }, { status: 201 });
}
