import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { STUDENT_VISIBLE_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";
import { enrollmentNeedsTeacherEvaluationPrompt } from "@/lib/teacher-class-evaluation";
import { enrollmentIdsWithRecordedPresence } from "@/lib/teacher-evaluation-presence";

export const dynamic = "force-dynamic";

async function loadStudent(userId: string) {
  const student = await prisma.student.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!student) return { error: jsonErr("NOT_FOUND", "Aluno não encontrado.", 404) };
  return { student };
}

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    const loaded = await loadStudent(user.id);
    if ("error" in loaded) return loaded.error;

    const rows = await prisma.enrollment.findMany({
      where: {
        studentId: loaded.student.id,
        status: { in: [...STUDENT_VISIBLE_ENROLLMENT_STATUSES] },
      },
      orderBy: { enrolledAt: "asc" },
      select: {
        id: true,
        teacherEvaluationReminderDismissedAt: true,
        teacherEvaluation: { select: { id: true } },
        classGroup: {
          select: {
            course: { select: { name: true } },
            teacher: { select: { name: true } },
          },
        },
      },
    });

    const withPresence = await enrollmentIdsWithRecordedPresence(rows.map((row) => row.id));
    const items = rows
      .filter((row) =>
        enrollmentNeedsTeacherEvaluationPrompt({
          hasEvaluation: row.teacherEvaluation != null,
          reminderDismissedAt: row.teacherEvaluationReminderDismissedAt,
          hasRecordedPresence: withPresence.has(row.id),
        }),
      )
      .map((row) => ({
        enrollmentId: row.id,
        courseName: row.classGroup.course.name,
        teacherName: row.classGroup.teacher.name,
      }));

    return jsonOk({ items });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar o aviso de avaliação.", 500);
  }
}

export async function POST() {
  try {
    const user = await requireRole("STUDENT");
    const loaded = await loadStudent(user.id);
    if ("error" in loaded) return loaded.error;

    const pending = await prisma.enrollment.findMany({
      where: {
        studentId: loaded.student.id,
        status: { in: [...STUDENT_VISIBLE_ENROLLMENT_STATUSES] },
        teacherEvaluationReminderDismissedAt: null,
        teacherEvaluation: { is: null },
      },
      select: { id: true },
    });
    const withPresence = await enrollmentIdsWithRecordedPresence(pending.map((row) => row.id));
    if (withPresence.size > 0) {
      await prisma.enrollment.updateMany({
        where: { id: { in: [...withPresence] } },
        data: { teacherEvaluationReminderDismissedAt: new Date() },
      });
    }

    return jsonOk({ dismissed: true });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível guardar a sua escolha.", 500);
  }
}
