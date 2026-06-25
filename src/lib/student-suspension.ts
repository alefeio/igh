import "server-only";

import { prisma } from "@/lib/prisma";
import {
  STUDENT_SUSPENSION_BLOCK_DETAIL,
  STUDENT_SUSPENSION_BLOCK_MESSAGE,
} from "@/lib/student-suspension-messages";

export {
  STUDENT_SUSPENSION_BLOCK_DETAIL,
  STUDENT_SUSPENSION_BLOCK_MESSAGE,
} from "@/lib/student-suspension-messages";

export type StudentSuspensionInfo = {
  enrollments: {
    id: string;
    courseName: string;
    classGroupLabel: string;
  }[];
};

export async function getStudentSuspensionInfo(userId: string): Promise<StudentSuspensionInfo> {
  const student = await prisma.student.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!student) return { enrollments: [] };

  const rows = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: "SUSPENDED" },
    select: {
      id: true,
      classGroup: {
        select: {
          startDate: true,
          startTime: true,
          endTime: true,
          location: true,
          course: { select: { name: true } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return {
    enrollments: rows.map((e) => {
      const cg = e.classGroup;
      const date = cg.startDate.toISOString().slice(0, 10).split("-").reverse().join("/");
      const horario = `${cg.startTime}–${cg.endTime}`;
      const loc = cg.location?.trim();
      return {
        id: e.id,
        courseName: cg.course.name,
        classGroupLabel: loc ? `${date} · ${horario} · ${loc}` : `${date} · ${horario}`,
      };
    }),
  };
}
