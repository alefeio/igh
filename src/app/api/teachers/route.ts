import { prisma } from "@/lib/prisma";
import { requireRole, requireStaffWrite, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createTeacherSchema } from "@/lib/validators/teachers";
import { birthDateInputToDate } from "@/lib/validators/person-contact";
import { maybeSendBirthdayGreetingForUser } from "@/lib/birthday-notifications";
import { createAuditLog } from "@/lib/audit";
import { getUnitsByTeacherId } from "@/lib/teacher-units";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateProfessorWelcome, templateAddedAsProfessor } from "@/lib/email/templates";

export async function GET(request: Request) {
  await requireRole(["MASTER", "ADMIN"]);

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

  const unitsByTeacher = await getUnitsByTeacherId(teachersRaw.map((t) => t.id));

  const teachers = teachersRaw.map((t) => {
    const { user, ...rest } = t;
    return {
      ...rest,
      phone: rest.phone || user?.whatsapp || null,
      birthDate: user?.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      units: unitsByTeacher.get(t.id) ?? [],
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

  let linkUserId = parsed.data.userId?.trim() || null;
  let name = parsed.data.name?.trim() ?? "";
  let email = parsed.data.email?.trim().toLowerCase() ?? "";
  let phoneDigits = parsed.data.phone?.replace(/\D/g, "") || null;
  let birthDateValue = birthDateInputToDate(parsed.data.birthDate);

  if (linkUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: linkUserId },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        birthDate: true,
        teacher: { select: { id: true, deletedAt: true } },
      },
    });
    if (!existing) {
      return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
    }
    if (existing.teacher && existing.teacher.deletedAt == null) {
      return jsonErr("ALREADY_TEACHER", "Este usuário já está cadastrado como professor.", 409);
    }
    if (existing.teacher) {
      return jsonErr(
        "ALREADY_TEACHER",
        "Este usuário já possui cadastro de professor inativo. Reative-o na lista de professores.",
        409,
      );
    }
    linkUserId = existing.id;
    name = existing.name;
    email = existing.email;
    if (!phoneDigits && existing.whatsapp) {
      phoneDigits = existing.whatsapp.replace(/\D/g, "").slice(0, 13) || null;
    }
    if (!birthDateValue && existing.birthDate) {
      birthDateValue = existing.birthDate;
    }
  }

  const existingUser = linkUserId
    ? { id: linkUserId }
    : await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

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
        name,
        phone: phoneDigits,
        email,
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
        ...(birthDateValue
          ? { birthDate: birthDateValue }
          : parsed.data.birthDate === null
            ? { birthDate: null }
            : {}),
      },
    });
    linkedToExistingUser = true;
    const { subject, html } = templateAddedAsProfessor({ name: teacher.name, email });
    const emailResult = await sendEmailAndRecord({
      to: email,
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
    if (!name || !email) {
      return jsonErr("VALIDATION_ERROR", "Nome e e-mail são obrigatórios para criar um novo usuário.", 400);
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
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
        name,
        phone: phoneDigits,
        email,
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
