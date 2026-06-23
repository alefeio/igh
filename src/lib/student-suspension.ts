import "server-only";

import { prisma } from "@/lib/prisma";

export const STUDENT_SUSPENSION_BLOCK_MESSAGE =
  "Sua matrícula está suspensa porque você acumulou três faltas consecutivas sem justificativa na frequência da turma. O acesso ao conteúdo online fica bloqueado até a regularização.";

export const STUDENT_SUSPENSION_BLOCK_DETAIL =
  "Para voltar a acessar o portal, compareça à aula presencial e peça ao professor que registre sua presença na frequência. Se a falta foi justificada, procure a secretaria do IGH.";

export type StudentSuspensionInfo = {
  blocked: boolean;
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
  if (!student) return { blocked: false, enrollments: [] };

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

  if (rows.length === 0) return { blocked: false, enrollments: [] };

  return {
    blocked: true,
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
