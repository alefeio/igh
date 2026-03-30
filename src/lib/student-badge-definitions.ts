/**
 * Conquistas e níveis do aluno — alinhado ao painel /dashboard.
 * Mantido num único módulo para reutilizar em notificações sem duplicar regras.
 */

export const POINTS_PER_LESSON = 10;

export const LEVELS = [
  { min: 0, name: "Iniciante", max: 49 },
  { min: 50, name: "Explorador", max: 149 },
  { min: 150, name: "Dedicado", max: 299 },
  { min: 300, name: "Expert", max: 499 },
  { min: 500, name: "Mestre", max: Infinity },
] as const;

export function getLevel(points: number) {
  const level = LEVELS.find((l) => points >= l.min && points <= l.max) ?? LEVELS[0];
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  const progressInLevel = next ? (points - level.min) / (next.min - level.min) : 1;
  return { ...level, progressInLevel, next };
}

export type BadgeId =
  | "primeira-aula"
  | "5-aulas"
  | "10-aulas"
  | "25-aulas"
  | "50-aulas"
  | "curso-concluido"
  | "multiplos-cursos"
  | "primeiro-exercicio"
  | "5-exercicios"
  | "10-exercicios"
  | "25-exercicios"
  | "40-exercicios"
  | "50-exercicios"
  | "primeira-presenca"
  | "5-presencas"
  | "10-presencas"
  | "25-presencas"
  | "40-presencas"
  | "primeiro-forum"
  | "5-forum"
  | "10-forum"
  | "25-forum";

/** Conquistas: aulas/cursos + mesmos eixos da pontuação (exercícios, frequência, fórum). */
export type StudentBadgeContext = {
  total: number;
  completed: number;
  enrollments: { lessonsTotal: number; lessonsCompleted: number }[];
  exerciseAttempts: number;
  attendancePresent: number;
  forumInteractions: number;
};

const BADGES: { id: BadgeId; label: string; condition: (d: StudentBadgeContext) => boolean }[] = [
  { id: "primeira-aula", label: "Primeira aula", condition: (d) => d.completed >= 1 },
  { id: "5-aulas", label: "5 aulas concluídas", condition: (d) => d.completed >= 5 },
  { id: "10-aulas", label: "10 aulas concluídas", condition: (d) => d.completed >= 10 },
  { id: "25-aulas", label: "25 aulas concluídas", condition: (d) => d.completed >= 25 },
  { id: "50-aulas", label: "50 aulas concluídas", condition: (d) => d.completed >= 50 },
  {
    id: "curso-concluido",
    label: "Curso concluído",
    condition: (d) => d.enrollments.some((e) => e.lessonsTotal > 0 && e.lessonsCompleted >= e.lessonsTotal),
  },
  { id: "multiplos-cursos", label: "Múltiplos cursos", condition: (d) => d.enrollments.length >= 2 },
  { id: "primeiro-exercicio", label: "Primeiro exercício respondido", condition: (d) => d.exerciseAttempts >= 1 },
  { id: "5-exercicios", label: "5 exercícios respondidos", condition: (d) => d.exerciseAttempts >= 5 },
  { id: "10-exercicios", label: "10 exercícios respondidos", condition: (d) => d.exerciseAttempts >= 10 },
  { id: "25-exercicios", label: "25 exercícios respondidos", condition: (d) => d.exerciseAttempts >= 25 },
  { id: "40-exercicios", label: "40 exercícios respondidos", condition: (d) => d.exerciseAttempts >= 40 },
  { id: "50-exercicios", label: "50 exercícios respondidos", condition: (d) => d.exerciseAttempts >= 50 },
  { id: "primeira-presenca", label: "Primeira presença registrada", condition: (d) => d.attendancePresent >= 1 },
  { id: "5-presencas", label: "5 presenças", condition: (d) => d.attendancePresent >= 5 },
  { id: "10-presencas", label: "10 presenças", condition: (d) => d.attendancePresent >= 10 },
  { id: "25-presencas", label: "25 presenças", condition: (d) => d.attendancePresent >= 25 },
  { id: "40-presencas", label: "40 presenças", condition: (d) => d.attendancePresent >= 40 },
  { id: "primeiro-forum", label: "Primeira participação no fórum", condition: (d) => d.forumInteractions >= 1 },
  { id: "5-forum", label: "5 participações no fórum", condition: (d) => d.forumInteractions >= 5 },
  { id: "10-forum", label: "10 participações no fórum", condition: (d) => d.forumInteractions >= 10 },
  { id: "25-forum", label: "25 participações no fórum", condition: (d) => d.forumInteractions >= 25 },
];

const STUDENT_BADGE_TRACKS: BadgeId[][] = [
  ["primeira-aula", "5-aulas", "10-aulas", "25-aulas", "50-aulas"],
  ["primeiro-exercicio", "5-exercicios", "10-exercicios", "25-exercicios", "40-exercicios", "50-exercicios"],
  ["primeira-presenca", "5-presencas", "10-presencas", "25-presencas", "40-presencas"],
  ["primeiro-forum", "5-forum", "10-forum", "25-forum"],
  ["curso-concluido"],
  ["multiplos-cursos"],
];

const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

export function getAllUnlockedBadges(ctx: StudentBadgeContext): { id: BadgeId; label: string }[] {
  const out: { id: BadgeId; label: string }[] = [];
  for (const track of STUDENT_BADGE_TRACKS) {
    for (const id of track) {
      const b = BADGE_BY_ID.get(id);
      if (!b) continue;
      if (b.condition(ctx)) out.push({ id: b.id, label: b.label });
    }
  }
  return out;
}

export function getNextBadgePerTrack(ctx: StudentBadgeContext): { id: BadgeId; label: string }[] {
  const out: { id: BadgeId; label: string }[] = [];
  for (const track of STUDENT_BADGE_TRACKS) {
    for (const id of track) {
      const b = BADGE_BY_ID.get(id);
      if (!b) continue;
      if (!b.condition(ctx)) {
        out.push({ id: b.id, label: b.label });
        break;
      }
    }
  }
  return out;
}
