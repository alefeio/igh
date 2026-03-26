import { prisma } from "@/lib/prisma";

const DAY_ORDER = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

/** Abreviações em minúsculas para exibição compacta (ex.: ter e qui). */
const DAY_SHORT_PT: Record<string, string> = {
  SEG: "seg",
  TER: "ter",
  QUA: "qua",
  QUI: "qui",
  SEX: "sex",
  SAB: "sáb",
  DOM: "dom",
};

export function formatDaysShortPtBr(days: string[]): string {
  if (!days?.length) return "—";
  const sorted = [...days].sort(
    (a, b) =>
      DAY_ORDER.indexOf(a as (typeof DAY_ORDER)[number]) -
      DAY_ORDER.indexOf(b as (typeof DAY_ORDER)[number]),
  );
  const labels = sorted.map((d) => DAY_SHORT_PT[d] ?? String(d).toLowerCase());
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

type ClassGroupTurmaParts = {
  course: { name: string } | null;
  location: string | null;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
};

export function formatClassGroupTurmaLine(cg: ClassGroupTurmaParts): string {
  const course = cg.course?.name?.trim() || "—";
  const loc = cg.location?.trim() || "—";
  const days = formatDaysShortPtBr(cg.daysOfWeek);
  const time =
    cg.startTime && cg.endTime ? `${cg.startTime}–${cg.endTime}` : "—";
  return `${course} · ${loc} · ${days} · ${time}`;
}

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
