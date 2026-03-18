import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPreEnrollmentSchema } from "@/lib/validators/public-enrollment";
import { verifyStudentToken } from "@/lib/student-token";

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

  const ACTIVE_CLASS_STATUSES = ["PLANEJADA", "ABERTA", "EM_ANDAMENTO"] as const;
  const currentEnrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: "ACTIVE",
      classGroup: { status: { in: [...ACTIVE_CLASS_STATUSES] } },
    },
    select: { classGroup: { select: { courseId: true } } },
  });
  const currentCourseIds = new Set(currentEnrollments.map((e) => e.classGroup.courseId));
  const newCourseId = classGroup.courseId;
  if (!currentCourseIds.has(newCourseId) && currentCourseIds.size >= 2) {
    return jsonErr(
      "LIMIT_EXCEEDED",
      "Você já está inscrito em 2 cursos com turmas em andamento ou abertas. O aluno pode ter no máximo 2 cursos nessa situação.",
      400
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
