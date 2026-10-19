import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { STUDENT_VISIBLE_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";
import { parseTeacherClassEvaluationBody } from "@/lib/teacher-class-evaluation";

export const dynamic = "force-dynamic";

async function loadOwnedEnrollment(enrollmentId: string, userId: string) {
  const student = await prisma.student.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!student) return { error: jsonErr("NOT_FOUND", "Aluno não encontrado.", 404) };

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      studentId: student.id,
      status: { in: [...STUDENT_VISIBLE_ENROLLMENT_STATUSES] },
    },
    select: {
      id: true,
      teacherEvaluation: {
        select: {
          rating: true,
          comment: true,
          anonymous: true,
          updatedAt: true,
          teacher: { select: { id: true, name: true } },
        },
      },
      classGroup: { select: { teacher: { select: { id: true, name: true } } } },
    },
  });
  if (!enrollment) return { error: jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404) };
  return { enrollment };
}

function toPayload(enrollment: {
  teacherEvaluation: {
    rating: number;
    comment: string | null;
    anonymous: boolean;
    updatedAt: Date;
    teacher: { id: string; name: string };
  } | null;
  classGroup: { teacher: { id: string; name: string } };
}) {
  const saved = enrollment.teacherEvaluation;
  const teacher = saved?.teacher ?? enrollment.classGroup.teacher;
  return {
    teacher: { id: teacher.id, name: teacher.name },
    evaluation: saved
      ? {
          rating: saved.rating,
          comment: saved.comment ?? "",
          anonymous: saved.anonymous,
          updatedAt: saved.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const user = await requireRole("STUDENT");
    const { enrollmentId } = await context.params;
    const loaded = await loadOwnedEnrollment(enrollmentId, user.id);
    if ("error" in loaded) return loaded.error;
    return jsonOk(toPayload(loaded.enrollment));
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar a avaliação.", 500);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const user = await requireRole("STUDENT");
    const { enrollmentId } = await context.params;
    const loaded = await loadOwnedEnrollment(enrollmentId, user.id);
    if ("error" in loaded) return loaded.error;

    const parsed = parseTeacherClassEvaluationBody(await request.json().catch(() => null));
    if (!parsed.ok) return jsonErr("VALIDATION_ERROR", parsed.message, 400);

    const existing = loaded.enrollment.teacherEvaluation;
    if (existing) {
      await prisma.teacherClassEvaluation.update({
        where: { enrollmentId },
        data: {
          rating: parsed.value.rating,
          comment: parsed.value.comment,
          anonymous: parsed.value.anonymous,
        },
      });
    } else {
      await prisma.teacherClassEvaluation.create({
        data: {
          enrollmentId,
          teacherId: loaded.enrollment.classGroup.teacher.id,
          rating: parsed.value.rating,
          comment: parsed.value.comment,
          anonymous: parsed.value.anonymous,
        },
      });
    }

    const refreshed = await loadOwnedEnrollment(enrollmentId, user.id);
    if ("error" in refreshed) return refreshed.error;
    return jsonOk(toPayload(refreshed.enrollment));
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível salvar a avaliação.", 500);
  }
}
