import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPublicStudentSchema } from "@/lib/validators/public-enrollment";
import { signStudentToken } from "@/lib/student-token";
import { birthDateToStudentPasswordParts } from "@/lib/student-password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateStudentRegistered } from "@/lib/email/templates";

function parseDateOnly(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function onlyDigits(v: string, max?: number): string {
  const d = v.replace(/\D/g, "");
  return max != null ? d.slice(0, max) : d;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createPublicStudentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { name, cpf, birthDate, phone, email, guardianCpf } = parsed.data;
  const emailNormalized = email && email.trim() ? email.trim().toLowerCase() : null;
  const cpfDigits = cpf ? onlyDigits(cpf, 11) : "";
  const cpfNormalized =
    cpfDigits.length === 11 ? cpfDigits : `MENOR-${randomUUID()}`;
  const guardianCpfNormalized = guardianCpf ? onlyDigits(guardianCpf, 11) : null;
  const phoneNormalized = phone.trim();

  if (cpfDigits.length === 11) {
    const existingCpf = await prisma.student.findUnique({
      where: { cpf: cpfNormalized },
      select: { id: true },
    });
    if (existingCpf) {
      return jsonErr("DUPLICATE_CPF", "Já existe um cadastro com este CPF. Faça login para continuar.", 409);
    }
  }

  if (emailNormalized) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: emailNormalized },
      select: { id: true },
    });
    if (existingEmail) {
      return jsonErr("DUPLICATE_EMAIL", "Este e-mail já está em uso. Faça login ou use outro e-mail.", 409);
    }
  }

  let birthDateValue: Date;
  try {
    birthDateValue = parseDateOnly(birthDate);
  } catch {
    return jsonErr("VALIDATION_ERROR", "Data de nascimento inválida.", 400);
  }

  if (emailNormalized) {
    const { password: birthDateAsPassword, formatted: birthDateFormatted } =
      birthDateToStudentPasswordParts(birthDateValue);
    const passwordHash = await hashPassword(birthDateAsPassword);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: emailNormalized,
        passwordHash,
        role: "STUDENT",
        isActive: true,
        mustChangePassword: true,
      },
      select: { id: true },
    });

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        cpf: cpfNormalized,
        birthDate: birthDateValue,
        phone: phoneNormalized,
        email: emailNormalized,
        userId: user.id,
        rg: "",
        gender: "PREFER_NOT_SAY",
        educationLevel: "OTHER",
        ...(guardianCpfNormalized ? { guardianCpf: guardianCpfNormalized } : {}),
      },
      select: {
        id: true,
        name: true,
        cpf: true,
        birthDate: true,
        phone: true,
        email: true,
      },
    });

    const token = await signStudentToken(student.id);

    const { subject, html } = templateStudentRegistered({
      name: student.name,
      email: emailNormalized,
      birthDateFormatted,
      birthDateAsPassword,
    });
    await sendEmailAndRecord({
      to: emailNormalized,
      subject,
      html,
      emailType: "student_registered",
      entityType: "Student",
      entityId: student.id,
      performedByUserId: null,
    });

    return jsonOk(
      {
        student: {
          id: student.id,
          name: student.name,
          cpf: student.cpf.startsWith("MENOR-") ? "" : student.cpf,
          birthDate: student.birthDate,
          phone: student.phone,
          email: student.email,
        },
        studentToken: token,
      },
      { status: 201 }
    );
  }

  const student = await prisma.student.create({
    data: {
      name: name.trim(),
      cpf: cpfNormalized,
      birthDate: birthDateValue,
      phone: phoneNormalized,
      email: null,
      userId: null,
      rg: "",
      gender: "PREFER_NOT_SAY",
      educationLevel: "OTHER",
      ...(guardianCpfNormalized ? { guardianCpf: guardianCpfNormalized } : {}),
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      birthDate: true,
      phone: true,
      email: true,
    },
  });

  const token = await signStudentToken(student.id);

  return jsonOk(
    {
      student: {
        id: student.id,
        name: student.name,
        cpf: student.cpf.startsWith("MENOR-") ? "" : student.cpf,
        birthDate: student.birthDate,
        phone: student.phone,
        email: student.email,
      },
      studentToken: token,
    },
    { status: 201 }
  );
}
