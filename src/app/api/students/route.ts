import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createStudentSchema, normalizeDigits } from "@/lib/validators/students";
import { createAuditLog } from "@/lib/audit";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateStudentRegistered } from "@/lib/email/templates";

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const includeDeleted = searchParams.get("includeDeleted") === "true" && user.role === "MASTER";

  const where: {
    deletedAt?: Date | null;
    OR?: Array<{ name?: { contains: string; mode: "insensitive" }; cpf?: string }>;
  } = {};

  if (!includeDeleted) {
    where.deletedAt = null;
  }

  if (q.length > 0) {
    const digits = normalizeDigits(q);
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      ...(digits.length === 11 ? [{ cpf: digits }] : []),
    ];
  }

  const students = await prisma.student.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return jsonOk({ students });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);

  const body = await request.json().catch(() => null);
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }

  const data = parsed.data;
  const cpfDigits = data.cpf ? normalizeDigits(data.cpf) : "";
  const isMinorBirth = (() => {
    const birth = new Date(data.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age < 18;
  })();
  const cpfNormalized =
    cpfDigits.length === 11 ? cpfDigits : `MENOR-${randomUUID()}`;
  if (cpfDigits.length === 11) {
    const existingCpf = await prisma.student.findUnique({
      where: { cpf: cpfNormalized },
      select: { id: true },
    });
    if (existingCpf) {
      return jsonErr("DUPLICATE_CPF", "Já existe um aluno com este CPF.", 409);
    }
  }

  const emailTrimmed = data.email?.trim() ? data.email.trim() : null;
  if (emailTrimmed) {
    const existingUser = await prisma.user.findUnique({
      where: { email: emailTrimmed },
      select: { id: true },
    });
    if (existingUser) {
      return jsonErr("EMAIL_IN_USE", "Já existe um usuário com este e-mail.", 409);
    }
  }

  const birthDate = new Date(data.birthDate);
  if (birthDate.toString() === "Invalid Date") {
    return jsonErr("VALIDATION_ERROR", "Data de nascimento inválida.", 400);
  }

  const student = await prisma.student.create({
    data: {
      name: data.name,
      birthDate,
      cpf: cpfNormalized,
      rg: (data.rg ?? "").trim() || "",
      email: emailTrimmed,
      phone: data.phone,
      cep: data.cep?.trim() ? data.cep.replace(/\D/g, "") : null,
      street: (data.street ?? "").trim() || "",
      number: (data.number ?? "").trim() || "",
      complement: data.complement ?? null,
      neighborhood: (data.neighborhood ?? "").trim() || "",
      city: (data.city ?? "Belém").trim() || "Belém",
      state: (data.state ?? "PA").trim().toUpperCase().slice(0, 2) || "PA",
      gender: data.gender,
      hasDisability: data.hasDisability,
      disabilityDescription: data.hasDisability ? (data.disabilityDescription ?? null) : null,
      educationLevel: data.educationLevel,
      isStudying: data.isStudying,
      studyShift: data.isStudying && data.studyShift ? data.studyShift : null,
      guardianName: data.guardianName ?? null,
      guardianCpf: data.guardianCpf ?? null,
      guardianRg: data.guardianRg ?? null,
      guardianPhone: data.guardianPhone ?? null,
      guardianRelationship: data.guardianRelationship ?? null,
    },
  });

  let birthDateFormattedForEmail: string | null = null;
  if (emailTrimmed) {
    const d = birthDate.getDate();
    const m = birthDate.getMonth() + 1;
    const y = birthDate.getFullYear();
    const day = String(d).padStart(2, "0");
    const month = String(m).padStart(2, "0");
    const birthDateAsPassword = `${day}${month}${y}`;
    birthDateFormattedForEmail = `${day}/${month}/${y}`;
    const passwordHash = await hashPassword(birthDateAsPassword);
    const createdUser = await prisma.user.create({
      data: {
        name: student.name,
        email: emailTrimmed,
        passwordHash,
        role: "STUDENT",
        isActive: true,
        mustChangePassword: true,
      },
    });
    await prisma.student.update({
      where: { id: student.id },
      data: { userId: createdUser.id },
    });
    student.userId = createdUser.id;
  }

  if (emailTrimmed && birthDateFormattedForEmail) {
    const { subject, html } = templateStudentRegistered({
      name: student.name,
      email: emailTrimmed,
      birthDateFormatted: birthDateFormattedForEmail,
    });
    await sendEmailAndRecord({
      to: emailTrimmed,
      subject,
      html,
      emailType: "student_registered",
      entityType: "Student",
      entityId: student.id,
      performedByUserId: user.id,
    });
  }

  await createAuditLog({
    entityType: "Student",
    entityId: student.id,
    action: "STUDENT_CREATE",
    diff: { after: student },
    performedByUserId: user.id,
  });

  return jsonOk({ student }, { status: 201 });
}
