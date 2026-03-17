import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateStudentSchema } from "@/lib/validators/students";

/** Retorna o aluno vinculado ao usuário logado (role STUDENT). Se não for STUDENT ou não tiver aluno, retorna student: null. */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonOk({ student: null, enrolledCourseIds: [] });
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      cpf: true,
      birthDate: true,
      phone: true,
      email: true,
    },
  });

  if (!student) {
    return jsonOk({ student: null, enrolledCourseIds: [] });
  }

  const ACTIVE_CLASS_STATUSES = ["PLANEJADA", "ABERTA", "EM_ANDAMENTO"] as const;
  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      studentId: student.id,
      status: "ACTIVE",
      classGroup: {
        status: { in: [...ACTIVE_CLASS_STATUSES] },
        course: { status: "ACTIVE" },
      },
    },
    select: { classGroup: { select: { courseId: true } } },
  });
  const enrolledCourseIds = [...new Set(activeEnrollments.map((e) => e.classGroup.courseId))];

  return jsonOk({
    student: {
      id: student.id,
      name: student.name,
      cpf: student.cpf,
      birthDate: student.birthDate,
      phone: student.phone,
      email: student.email,
    },
    enrolledCourseIds,
  });
}

/** Atualiza o próprio cadastro do aluno (apenas STUDENT). */
export async function PATCH(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    include: { user: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Cadastro de aluno não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateStudentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  if (data.cpf != null && data.cpf !== student.cpf) {
    const duplicate = await prisma.student.findUnique({
      where: { cpf: data.cpf },
      select: { id: true },
    });
    if (duplicate) {
      return jsonErr("DUPLICATE_CPF", "Já existe um cadastro com este CPF.", 409);
    }
  }

  const newEmail = data.email !== undefined ? (data.email?.trim() ? data.email.trim() : null) : student.email;
  if (newEmail && newEmail !== student.email) {
    const emailTaken = await prisma.user.findFirst({
      where: { email: newEmail, id: { not: student.userId ?? "" } },
      select: { id: true },
    });
    if (emailTaken) {
      return jsonErr("EMAIL_IN_USE", "Este e-mail já está em uso.", 409);
    }
  }

  const birthDate = data.birthDate != null ? new Date(data.birthDate) : undefined;
  const updateData = {
    ...(data.name != null && { name: data.name }),
    ...(birthDate != null && { birthDate }),
    ...(data.cpf != null && { cpf: data.cpf }),
    ...(data.rg != null && { rg: data.rg }),
    ...(data.email !== undefined && { email: data.email?.trim() ? data.email.trim() : null }),
    ...(data.phone != null && { phone: data.phone }),
    ...(data.cep !== undefined && { cep: data.cep?.trim() ? data.cep.replace(/\D/g, "") : null }),
    ...(data.street != null && { street: data.street }),
    ...(data.number != null && { number: data.number }),
    ...(data.complement !== undefined && { complement: data.complement ?? null }),
    ...(data.neighborhood != null && { neighborhood: data.neighborhood }),
    ...(data.city != null && { city: data.city }),
    ...(data.state != null && { state: data.state }),
    ...(data.gender != null && { gender: data.gender }),
    ...(data.hasDisability != null && { hasDisability: data.hasDisability }),
    ...(data.disabilityDescription !== undefined && {
      disabilityDescription: data.disabilityDescription || null,
    }),
    ...(data.educationLevel != null && { educationLevel: data.educationLevel }),
    ...(data.isStudying != null && { isStudying: data.isStudying }),
    ...(data.studyShift !== undefined && { studyShift: data.studyShift ?? null }),
    ...(data.guardianName !== undefined && { guardianName: data.guardianName ?? null }),
    ...(data.guardianCpf !== undefined && { guardianCpf: data.guardianCpf ?? null }),
    ...(data.guardianRg !== undefined && { guardianRg: data.guardianRg ?? null }),
    ...(data.guardianPhone !== undefined && { guardianPhone: data.guardianPhone ?? null }),
    ...(data.guardianRelationship !== undefined && {
      guardianRelationship: data.guardianRelationship ?? null,
    }),
  };

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: updateData,
  });

  if (student.userId && updated.email) {
    await prisma.user.update({
      where: { id: student.userId },
      data: { name: updated.name, email: updated.email },
    });
  }

  return jsonOk({ student: updated });
}
