import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPreEnrollmentSchema } from "@/lib/validators/public-enrollment";
import { verifyStudentToken } from "@/lib/student-token";

function toDateOnlyString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const part = value.trim().split("T")[0]?.split(" ")[0] ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function dateOnlyToUtcDate(dateOnly: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createPreEnrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { classGroupId, studentToken } = parsed.data;

  let studentId: string | null = null;

  const session = await getSessionUserFromCookie();
  if (session?.role === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId: session.id },
      select: { id: true },
    });
    if (student) studentId = student.id;
  }

  if (!studentId && studentToken) {
    const payload = await verifyStudentToken(studentToken);
    if (payload) studentId = payload.studentId;
  }

  if (!studentId) {
    return jsonErr(
      "UNAUTHORIZED",
      "Faça login ou cadastre-se para realizar a pré-matrícula.",
      401
    );
  }

  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    include: { course: true },
  });
  if (!classGroup) {
    return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);
  }
  // Turmas EXTERNO e INTERNO não devem ser inscrevíveis pelo público.
  if (!["ABERTA", "EM_ANDAMENTO", "PLANEJADA"].includes(classGroup.status)) {
    return jsonErr("VALIDATION_ERROR", "Esta turma não está aceitando matrículas no momento.", 400);
  }
  if (classGroup.status === "INTERNO" || classGroup.status === "EXTERNO") {
    return jsonErr(
      "FORBIDDEN",
      "Esta turma não está disponível para inscrição pública. Entre em contato com a secretaria.",
      403
    );
  }

  const activeCount = await prisma.enrollment.count({
    where: { classGroupId, status: "ACTIVE" },
  });
  if (activeCount >= classGroup.capacity) {
    return jsonErr("VALIDATION_ERROR", "Esta turma não possui vagas disponíveis.", 400);
  }

  const existing = await prisma.enrollment.findFirst({
    where: { studentId, classGroupId, status: "ACTIVE" },
  });
  if (existing) {
    return jsonErr("DUPLICATE", "Você já está inscrito nesta turma.", 409);
  }

  const currentEmAndamentoEnrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: "ACTIVE",
      classGroup: { status: "EM_ANDAMENTO" },
    },
    select: { classGroup: { select: { courseId: true, startDate: true, endDate: true } } },
  });
  const newCourseId = classGroup.courseId;
  const candStartStr = toDateOnlyString(classGroup.startDate);
  const candEndStr = toDateOnlyString(classGroup.endDate ?? classGroup.startDate);
  const candStart = candStartStr ? dateOnlyToUtcDate(candStartStr) : null;
  const candEnd = candEndStr ? dateOnlyToUtcDate(candEndStr) : null;
  if (!candStart || !candEnd) {
    return jsonErr("VALIDATION_ERROR", "Data da turma inválida para inscrição. Contate a secretaria.", 400);
  }

  const overlappingCourseIds = new Set<string>();
  for (const e of currentEmAndamentoEnrollments) {
    const ipStartStr = toDateOnlyString(e.classGroup.startDate);
    const ipEndStr = toDateOnlyString(e.classGroup.endDate ?? e.classGroup.startDate);
    const ipStart = ipStartStr ? dateOnlyToUtcDate(ipStartStr) : null;
    const ipEnd = ipEndStr ? dateOnlyToUtcDate(ipEndStr) : null;
    if (!ipStart || !ipEnd) {
      // conservador: se não souber datas, considera como sobreposição
      overlappingCourseIds.add(e.classGroup.courseId);
      continue;
    }
    if (rangesOverlap(ipStart, ipEnd, candStart, candEnd)) {
      overlappingCourseIds.add(e.classGroup.courseId);
    }
  }

  // Limite de 2 cursos se aplica apenas quando o período da turma nova "coincide" com 2 turmas em andamento.
  if (overlappingCourseIds.size >= 2 && !overlappingCourseIds.has(newCourseId)) {
    return jsonErr(
      "LIMIT_EXCEEDED",
      "Você já está inscrito em 2 cursos com turmas em andamento no mesmo período. Aguarde o encerramento de alguma turma ou entre em contato com a secretaria.",
      400,
    );
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      classGroupId,
      status: "ACTIVE",
      isPreEnrollment: true,
    },
    include: {
      student: { select: { id: true, name: true } },
      classGroup: { include: { course: { select: { name: true } } } },
    },
  });

  return jsonOk(
    {
      enrollment: {
        id: enrollment.id,
        courseName: enrollment.classGroup.course.name,
        isPreEnrollment: true,
      },
    },
    { status: 201 }
  );
}
