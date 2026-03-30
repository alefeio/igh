import "server-only";

import { prisma } from "@/lib/prisma";
import { formatClassGroupTurmaLine } from "@/lib/turma-display";

export type ExperienceFeedbackTurmaContext = {
  turmaLabel: string;
  teacherNames: string[];
};

/**
 * Para cada usuário (aluno com conta), turmas ativas: curso, local, dias e horário;
 * professores distintos das turmas ativas (para exibir junto ao comentário sobre o professor).
 */
export async function loadExperienceFeedbackTurmaByUserIds(
  userIds: string[],
): Promise<Map<string, ExperienceFeedbackTurmaContext>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ExperienceFeedbackTurmaContext>();
  if (unique.length === 0) return map;

  const students = await prisma.student.findMany({
    where: { userId: { in: unique }, deletedAt: null },
    select: {
      userId: true,
      enrollments: {
        where: { status: "ACTIVE" },
        select: {
          classGroup: {
            select: {
              course: { select: { name: true } },
              location: true,
              daysOfWeek: true,
              startTime: true,
              endTime: true,
              teacher: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  for (const s of students) {
    if (!s.userId) continue;
    const lines: string[] = [];
    const teachers = new Set<string>();
    for (const e of s.enrollments) {
      const cg = e.classGroup;
      lines.push(formatClassGroupTurmaLine(cg));
      const tn = cg.teacher?.name?.trim();
      if (tn) teachers.add(tn);
    }
    map.set(s.userId, {
      turmaLabel: lines.length ? lines.join(" | ") : "—",
      teacherNames: [...teachers].sort((a, b) => a.localeCompare(b, "pt-BR")),
    });
  }

  for (const uid of unique) {
    if (!map.has(uid)) {
      map.set(uid, { turmaLabel: "—", teacherNames: [] });
    }
  }
  return map;
}
