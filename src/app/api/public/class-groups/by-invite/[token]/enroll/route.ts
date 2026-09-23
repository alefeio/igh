import { randomUUID } from "node:crypto";
import {
  clientIpFromRequest,
  isHoneypotFilled,
} from "@/lib/bot-protection";
import { CLASS_GROUP_OPERATIONAL_ENROLLABLE } from "@/lib/class-group-scope";
import { hashPassword } from "@/lib/auth";
import { sendEnrollmentWelcomeForStudent } from "@/lib/enrollment-welcome-email";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";
import { birthDateToStudentPasswordParts } from "@/lib/student-password";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { createPublicStudentSchema } from "@/lib/validators/public-enrollment";
import { jsonErr, jsonOk } from "@/lib/http";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_TOKEN = 80;

function parseDateOnly(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function onlyDigits(v: string, max?: number): string {
  const d = v.replace(/\D/g, "");
  return max != null ? d.slice(0, max) : d;
}

/**
 * Matrícula ACTIVE via link do professor (/turma/[token]).
 * Cria ou reutiliza aluno (e-mail/CPF); isPreEnrollment = false.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await context.params;
  const token = decodeURIComponent(rawToken ?? "").trim();
  if (!token) {
    return jsonErr("NOT_FOUND", "Link de inscrição inválido.", 404);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (isHoneypotFilled(body)) {
    return jsonOk({ enrollmentId: "ok", emailSent: false });
  }

  const ip = clientIpFromRequest(request);
  const ipLimit = checkRateLimit(`class-invite-enroll:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
  if (!ipLimit.ok) {
    return jsonErr(
      "RATE_LIMIT",
      `Muitas tentativas. Aguarde ${ipLimit.retryAfterSec} segundos.`,
      429,
    );
  }
  const tokenLimit = checkRateLimit(`class-invite-enroll:token:${token}`, MAX_PER_TOKEN, WINDOW_MS);
  if (!tokenLimit.ok) {
    return jsonErr(
      "RATE_LIMIT",
      `Muitas tentativas neste link. Aguarde ${tokenLimit.retryAfterSec} segundos.`,
      429,
    );
  }

  const parsed = createPublicStudentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const cg = await prisma.classGroup.findFirst({
    where: { enrollmentInviteToken: token },
    select: {
      id: true,
      status: true,
      capacity: true,
      course: { select: { name: true } },
    },
  });
  if (!cg) {
    return jsonErr("NOT_FOUND", "Link de inscrição inválido ou expirado.", 404);
  }
  if (!(CLASS_GROUP_OPERATIONAL_ENROLLABLE as readonly string[]).includes(cg.status)) {
    return jsonErr(
      "VALIDATION_ERROR",
      cg.status === "CANCELADA"
        ? "Esta turma foi cancelada."
        : cg.status === "ENCERRADA"
          ? "Esta turma já foi encerrada."
          : "Esta turma não está aceitando matrículas no momento.",
      400,
    );
  }

  const occupiedCount = await prisma.enrollment.count({
    where: { classGroupId: cg.id, status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } },
  });
  if (occupiedCount >= cg.capacity) {
    return jsonErr("VALIDATION_ERROR", "Esta turma não possui vagas disponíveis.", 400);
  }

  const { name, cpf, birthDate, phone, email, guardianCpf } = parsed.data;
  const emailNormalized = email && email.trim() ? email.trim().toLowerCase() : null;
  const cpfDigits = cpf ? onlyDigits(cpf, 11) : "";
  const guardianCpfNormalized = guardianCpf ? onlyDigits(guardianCpf, 11) : null;
  const phoneNormalized = phone.trim();

  let birthDateValue: Date;
  try {
    birthDateValue = parseDateOnly(birthDate);
  } catch {
    return jsonErr("VALIDATION_ERROR", "Data de nascimento inválida.", 400);
  }

  let studentId: string | null = null;

  if (cpfDigits.length === 11) {
    const byCpf = await prisma.student.findFirst({
      where: { cpf: cpfDigits, deletedAt: null },
      select: { id: true },
    });
    if (byCpf) studentId = byCpf.id;
  }

  if (!studentId && emailNormalized) {
    const byEmail = await prisma.student.findFirst({
      where: { email: emailNormalized, deletedAt: null },
      select: { id: true },
    });
    if (byEmail) studentId = byEmail.id;
    if (!studentId) {
      const user = await prisma.user.findUnique({
        where: { email: emailNormalized },
        select: { id: true },
      });
      if (user) {
        const linked = await prisma.student.findFirst({
          where: { userId: user.id, deletedAt: null },
          select: { id: true },
        });
        if (linked) studentId = linked.id;
      }
    }
  }

  if (!studentId) {
    const cpfNormalized = cpfDigits.length === 11 ? cpfDigits : `MENOR-${randomUUID()}`;
    let userId: string | null = null;

    if (emailNormalized) {
      const existingUser = await prisma.user.findUnique({
        where: { email: emailNormalized },
        select: { id: true },
      });
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { password: birthDateAsPassword } = birthDateToStudentPasswordParts(birthDateValue);
        const passwordHash = await hashPassword(birthDateAsPassword);
        const createdUser = await prisma.user.create({
          data: {
            name: name.trim(),
            email: emailNormalized,
            passwordHash,
            role: "STUDENT",
            isActive: true,
            mustChangePassword: true,
            birthDate: birthDateValue,
            whatsapp: phoneNormalized.replace(/\D/g, "") || null,
          },
          select: { id: true },
        });
        userId = createdUser.id;
      }
    }

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        cpf: cpfNormalized,
        birthDate: birthDateValue,
        phone: phoneNormalized,
        email: emailNormalized,
        userId,
        rg: "",
        gender: "PREFER_NOT_SAY",
        educationLevel: "OTHER",
        ...(guardianCpfNormalized ? { guardianCpf: guardianCpfNormalized } : {}),
      },
      select: { id: true },
    });
    studentId = student.id;
  }

  const existing = await prisma.enrollment.findFirst({
    where: {
      studentId,
      classGroupId: cg.id,
      status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] },
    },
    select: { id: true },
  });
  if (existing) {
    return jsonErr("DUPLICATE", "Você já está matriculado nesta turma.", 409);
  }

  // Re-check capacity inside a short window before create
  const occupiedAgain = await prisma.enrollment.count({
    where: { classGroupId: cg.id, status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } },
  });
  if (occupiedAgain >= cg.capacity) {
    return jsonErr("VALIDATION_ERROR", "Esta turma não possui vagas disponíveis.", 400);
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      classGroupId: cg.id,
      status: "ACTIVE",
      isPreEnrollment: false,
    },
    select: { id: true },
  });

  let emailSent = false;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { email: true },
  });
  if (student?.email) {
    const welcome = await sendEnrollmentWelcomeForStudent({
      studentId,
      enrollmentId: enrollment.id,
      auditExtra: { triggeredBy: "class_group_invite_link" },
    });
    emailSent = Boolean(welcome.emailSent || welcome.queued) && !welcome.skipped;
  }

  return jsonOk(
    {
      enrollmentId: enrollment.id,
      courseName: cg.course.name,
      emailSent,
      studentHadNoEmail: !student?.email,
    },
    { status: 201 },
  );
}
