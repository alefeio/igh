import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createStudentSchema, normalizeDigits } from "@/lib/validators/students";
import { createAuditLog } from "@/lib/audit";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateStudentRegistered, templateAddedAsStudent } from "@/lib/email/templates";
import { birthDateToStudentPasswordParts } from "@/lib/student-password";

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER"]);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const includeDeleted = searchParams.get("includeDeleted") === "true" && user.role === "MASTER";

  const where: {
    deletedAt?: Date | null;
    id?: { in: string[] };
    OR?: Array<
      | { name: { contains: string; mode: "insensitive" } }
      | { cpf: string }
      | { cpf: { contains: string } }
    >;
  } = {};

  if (!includeDeleted) {
    where.deletedAt = null;
  }

  // Professor: apenas alunos matriculados em turmas que ele leciona
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      return jsonOk({ students: [] });
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { classGroup: { teacherId: teacher.id } },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    const studentIds = enrollments.map((e) => e.studentId);
    if (studentIds.length === 0) {
      return jsonOk({ students: [] });
    }
    where.id = { in: studentIds };
  }

  if (q.length > 0) {
    const digits = normalizeDigits(q);
    const orConditions: (typeof where)["OR"] = [{ name: { contains: q, mode: "insensitive" } }];
    if (digits.length >= 10 && digits.length <= 11) {
      const cpfExact = digits.length === 11 ? digits : digits.padStart(11, "0");
      orConditions.push({ cpf: cpfExact });
    }
    if (digits.length >= 9 && digits.length <= 11) {
      orConditions.push({ cpf: { contains: digits } });
    }
    where.OR = orConditions;
  }

  const students = await prisma.student.findMany({
    where,
    orderBy: { name: "asc" },
    include: { attachments: { select: { type: true } } },
  });

  const studentsWithDocs = students.map((s) => {
    const { attachments, ...rest } = s;
    const hasIdDocument = attachments.some((a) => a.type === "ID_DOCUMENT");
    const hasAddressProof = attachments.some((a) => a.type === "ADDRESS_PROOF");
    return { ...rest, hasIdDocument, hasAddressProof };
  });

  return jsonOk({ students: studentsWithDocs });
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
  let existingUser: { id: string } | null = null;
  if (emailTrimmed) {
    const u = await prisma.user.findUnique({
      where: { email: emailTrimmed },
      select: { id: true },
    });
    if (u) {
      const existingStudent = await prisma.student.findFirst({
        where: { userId: u.id, deletedAt: null },
        select: { id: true },
      });
      if (existingStudent) {
        return jsonErr("ALREADY_STUDENT", "Este usuário já está cadastrado como aluno.", 409);
      }
      // Multi-perfil: vincula ao usuário existente (pode ser professor ou admin); só bloqueia se já for aluno.
      existingUser = u;
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
  let birthDateAsPasswordForEmail: string | null = null;
  if (existingUser) {
    await prisma.student.update({
      where: { id: student.id },
      data: { userId: existingUser.id },
    });
    student.userId = existingUser.id;
    if (emailTrimmed) {
      const { subject, html } = templateAddedAsStudent({ name: student.name, email: emailTrimmed });
      await sendEmailAndRecord({
        to: emailTrimmed,
        subject,
        html,
        emailType: "added_as_student",
        entityType: "Student",
        entityId: student.id,
        performedByUserId: user.id,
      });
    }
  } else if (emailTrimmed) {
    const { password: birthDateAsPassword, formatted: birthDateFormatted } =
      birthDateToStudentPasswordParts(birthDate);
    birthDateFormattedForEmail = birthDateFormatted;
    birthDateAsPasswordForEmail = birthDateAsPassword;
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

  if (emailTrimmed && birthDateFormattedForEmail && !existingUser) {
    const { subject, html } = templateStudentRegistered({
      name: student.name,
      email: emailTrimmed,
      birthDateFormatted: birthDateFormattedForEmail,
      ...(birthDateAsPasswordForEmail && { birthDateAsPassword: birthDateAsPasswordForEmail }),
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

  return jsonOk({ student, linkedToExistingUser: !!existingUser }, { status: 201 });
}
