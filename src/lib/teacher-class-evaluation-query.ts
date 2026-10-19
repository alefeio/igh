import "server-only";

import { prisma } from "@/lib/prisma";
import { teacherMaterialClassLabel } from "@/lib/teacher-class-material";
import { teacherEvaluationAuthorLabel } from "@/lib/teacher-class-evaluation";

const evaluationSelect = {
  id: true,
  rating: true,
  comment: true,
  anonymous: true,
  createdAt: true,
  teacher: { select: { name: true } },
  enrollment: {
    select: {
      student: { select: { name: true } },
      classGroup: {
        select: {
          daysOfWeek: true,
          startTime: true,
          endTime: true,
          course: { select: { name: true } },
        },
      },
    },
  },
} as const;

export async function listTeacherClassEvaluations(
  teacherId?: string,
  options?: { revealIdentity?: boolean },
) {
  const rows = await prisma.teacherClassEvaluation.findMany({
    where: teacherId ? { teacherId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: evaluationSelect,
  });
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment ?? "",
    anonymous: row.anonymous,
    createdAt: row.createdAt.toISOString(),
    authorLabel: teacherEvaluationAuthorLabel(row.anonymous, row.enrollment.student.name, options),
    courseName: row.enrollment.classGroup.course.name,
    classLabel: teacherMaterialClassLabel(row.enrollment.classGroup),
    teacherName: row.teacher.name,
  }));
}
