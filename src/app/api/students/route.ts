import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createStudentSchema, normalizeDigits } from "@/lib/validators/students";
import { createAuditLog } from "@/lib/audit";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateStudentRegistered, templateAddedAsStudent } from "@/lib/email/templates";
import { birthDateToStudentPasswordParts } from "@/lib/student-password";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** Termos de busca por nome (texto) e CPF (somente dígitos, parcial ou completo). */
function buildStudentSearchOr(q: string): Prisma.StudentWhereInput[] {
  const trimmed = q.trim();
  const digits = normalizeDigits(trimmed);
  const or: Prisma.StudentWhereInput[] = [{ name: { contains: trimmed, mode: "insensitive" } }];

  if (digits.length === 0) {
    return or;
  }

  if (digits.length === 11) {
    or.push({ cpf: digits });
  } else if (digits.length === 10) {
    or.push({ cpf: { startsWith: digits } });
    or.push({ cpf: { contains: digits } });
  } else {
    or.push({ cpf: { contains: digits } });
  }

  if (digits.length === 11) {
    or.push({ guardianCpf: digits });
  } else if (digits.length >= 3) {
    or.push({ guardianCpf: { contains: digits } });
  }

  return or;
}

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER", "COORDINATOR"]);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const includeDeleted =
    searchParams.get("includeDeleted") === "true" &&
    (user.role === "MASTER" || user.role === "ADMIN" || user.role === "COORDINATOR");

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSizeRaw = parseInt(searchParams.get("pageSize") ?? "20", 10) || 20;
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw as (typeof PAGE_SIZE_OPTIONS)[number])
    ? pageSizeRaw
    : 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.StudentWhereInput = {};

  if (!includeDeleted) {
    where.deletedAt = null;
  }

  let teacherStudentIds: string[] | null = null;

  // Professor: apenas alunos matriculados em turmas que ele leciona
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      return jsonOk({ students: [], total: 0, page: 1, pageSize });
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { classGroup: { teacherId: teacher.id } },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    teacherStudentIds = enrollments.map((e) => e.studentId);
    if (teacherStudentIds.length === 0) {
      return jsonOk({ students: [], total: 0, page: 1, pageSize });
    }
  }

  if (q.length > 0) {
    const searchOr = buildStudentSearchOr(q);
    if (teacherStudentIds) {
      where.AND = [{ id: { in: teacherStudentIds } }, { OR: searchOr }];
    } else {
      where.OR = searchOr;
    }
  } else if (teacherStudentIds) {
    where.id = { in: teacherStudentIds };
  }

  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      include: { attachments: { select: { type: true } } },
    }),
    prisma.student.count({ where }),
  ]);

  const studentsWithDocs = students.map((s) => {
    const { attachments, ...rest } = s;
    const hasIdDocument = attachments.some((a) => a.type === "ID_DOCUMENT");
    const hasAddressProof = attachments.some((a) => a.type === "ADDRESS_PROOF");
    return { ...rest, hasIdDocument, hasAddressProof };
  });

  return jsonOk({ students: studentsWithDocs, total, page, pageSize });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);

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
