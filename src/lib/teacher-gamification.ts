import "server-only";

import { prisma } from "@/lib/prisma";

/** Meta de exercícios por aula (cadastro completo). */
export const EXERCISES_TARGET_PER_LESSON = 5;

export const GAMIFICATION_POINTS = {
  /** Por aula do curso com conteúdo suficiente */
  contentPerLesson: 10,
  /** Por aula com 5 exercícios válidos */
  exercisesFullLesson: 10,
  /** Por sessão já realizada com frequência completa */
  attendancePerSession: 15,
  /** Bônus por aluno com frequência marcada como presente (present=true) */
  attendancePerPresentStudent: 2,
  /** Por resposta do professor (ou aluno) no fórum */
  forumPerReply: 5,
} as const;

/** Metadados da tabela de ranking em /gamificacao (rótulo, alinhamento e texto explicativo). */
export type GamificationRankingColumnMeta = {
  label: string;
  align: "left" | "right";
  description: string;
};

/** Colunas do ranking na ordem exibida; descrições alinhadas às regras de pontuação. */
export function getGamificationRankingTableColumns(): readonly GamificationRankingColumnMeta[] {
  const p = GAMIFICATION_POINTS;
  const ex = EXERCISES_TARGET_PER_LESSON;
  return [
    {
      label: "#",
      align: "left",
      description:
        "Posição no ranking entre professores ativos. A ordenação é pela coluna Total (maior pontuação primeiro).",
    },
    {
      label: "Professor",
      align: "left",
      description:
        "Nome do professor. As contas somam apenas as turmas em que ele está como professor (e as aulas dos cursos dessas turmas entram no cálculo).",
    },
    {
      label: "Total",
      align: "right",
      description:
        "Soma: Conteúdo + Exercícios (cadastro na aula) + Frequência + Fórum + Horas assistidas + Exercícios realizados.",
    },
    {
      label: "Conteúdo",
      align: "right",
      description: `Para cada aula no escopo (CourseLesson) dos cursos das turmas do professor: removemos HTML do campo contentRich e medimos o tamanho do texto resultante. Se for >= ${MIN_RICH_TEXT_LENGTH} caracteres, essa aula conta como "com conteúdo". Pontos = (aulas com conteúdo) * ${p.contentPerLesson}.`,
    },
    {
      label: "Exercícios",
      align: "right",
      description: `Para cada aula no escopo (CourseLesson): contamos exercícios de múltipla escolha "válidos". Um exercício é válido se tem pelo menos 2 opções e exatamente 1 opção marcada como correta (isCorrect=true). Se a aula tiver pelo menos ${ex} exercícios válidos, ela conta como "com exercícios completos". Pontos = (aulas completas) * ${p.exercisesFullLesson}.`,
    },
    {
      label: "Frequência",
      align: "right",
      description:
        `Considera apenas sessões já ocorridas (sessionDate <= hoje; "hoje" calculado em UTC-3). Para cada sessão: ` +
        `need = quantidade de alunos ACTIVE na turma (classGroup). have = quantidade de registros em SessionAttendance para aquela sessão. ` +
        `Se have >= need, conta como "frequência completa". Pontos de sessão completa = ${p.attendancePerSession} por sessão. ` +
        `Além disso, soma bônus por aluno presente: para cada registro com present=true em SessionAttendance naquela sessão, adiciona ${p.attendancePerPresentStudent} pontos por aluno. (Pontuação de Frequência = sessões completas * attendancePerSession + presentes * attendancePerPresentStudent).`,
    },
    {
      label: "Fórum",
      align: "right",
      description:
        `Conta participação no fórum nas dúvidas do escopo: ` +
        `1) Respostas do professor em LessonQuestionTeacherReply; ` +
        `2) Respostas dos alunos em EnrollmentLessonQuestionReply. ` +
        `Considera apenas dúvidas cuja question.lessonId pertence às aulas dos cursos das turmas do professor (e, para as respostas dos alunos, apenas as respostas vinculadas aos enrollmentIds dessas turmas). ` +
        `Cada resposta vale ${p.forumPerReply} pontos e NÃO existe teto: mais respostas geram mais pontos.`,
    },
    {
      label: "Horas assist.",
      align: "right",
      description:
        "Soma dos minutos de estudo que os alunos acumularam nas aulas do escopo (campo totalMinutesStudied), convertida em horas (arredondada). Cada hora soma 1 ponto nesta coluna e no total.",
    },
    {
      label: "Ex. realizados",
      align: "right",
      description:
        "Para cada tentativa de exercício pelos alunos (respostas no escopo) soma-se 1; para cada tentativa correta soma-se mais 1. Valor = tentativas + acertos (entra no total).",
    },
  ];
}

const MIN_RICH_TEXT_LENGTH = 40;

/** Data (somente dia) no calendário do Brasil (UTC−3) para comparar com sessionDate. */
export function getBrazilTodayDateOnly(): Date {
  const BRAZIL_UTC_OFFSET_HOURS = 3;
  const now = new Date();
  const brazil = new Date(now.getTime() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(Date.UTC(brazil.getUTCFullYear(), brazil.getUTCMonth(), brazil.getUTCDate()));
}

export function stripHtmlRichText(html: string | null | undefined): string {
  if (!html?.trim()) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidExercise(options: { isCorrect: boolean }[]): boolean {
  if (options.length < 2) return false;
  const correct = options.filter((o) => o.isCorrect).length;
  return correct === 1;
}

export type TeacherGamificationTotals = {
  lessonsTotal: number;
  lessonsWithContent: number;
  lessonsWithFiveExercises: number;
  pastSessionsTotal: number;
  pastSessionsAttendanceComplete: number;
  teacherRepliesInScope: number;
  studentRepliesInScope: number;
  /** Soma dos minutos estudados (alunos, aulas no escopo). */
  studentTotalMinutesStudied: number;
  /** `round(minutos / 60)` — entra no total como pontuação. */
  studentWatchHours: number;
  studentExerciseAttempts: number;
  studentExerciseCorrect: number;
};

export type TeacherGamificationPoints = {
  content: number;
  exercises: number;
  attendance: number;
  forum: number;
  /** Horas totais de estudo dos alunos (1 h = 1 ponto). */
  studentWatchHours: number;
  /** Tentativas em exercícios + acertos (cada um soma 1). */
  studentExerciseScore: number;
  total: number;
};

export type TeacherGamificationResult = {
  teacherId: string;
  teacherName: string;
  totals: TeacherGamificationTotals;
  points: TeacherGamificationPoints;
  /** Estimativa do teto de pontos (conteúdo + exercícios + frequência + teto fórum + teto engajamento), para barra de % */
  maxPointsEstimate: number;
};

/**
 * Calcula gamificação do professor: cursos das turmas que leciona (qualquer status de turma).
 */
export async function computeTeacherGamification(teacherId: string): Promise<TeacherGamificationResult | null> {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!teacher) return null;

  const groups = await prisma.classGroup.findMany({
    where: { teacherId },
    select: { id: true, courseId: true },
  });
  const courseIds = [...new Set(groups.map((g) => g.courseId))];
  if (courseIds.length === 0) {
    const emptyTotals: TeacherGamificationTotals = {
      lessonsTotal: 0,
      lessonsWithContent: 0,
      lessonsWithFiveExercises: 0,
      pastSessionsTotal: 0,
      pastSessionsAttendanceComplete: 0,
      teacherRepliesInScope: 0,
      studentRepliesInScope: 0,
      studentTotalMinutesStudied: 0,
      studentWatchHours: 0,
      studentExerciseAttempts: 0,
      studentExerciseCorrect: 0,
    };
    const emptyPoints: TeacherGamificationPoints = {
      content: 0,
      exercises: 0,
      attendance: 0,
      forum: 0,
      studentWatchHours: 0,
      studentExerciseScore: 0,
      total: 0,
    };
    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      totals: emptyTotals,
      points: emptyPoints,
      maxPointsEstimate: 1,
    };
  }

  const modules = await prisma.courseModule.findMany({
    where: { courseId: { in: courseIds } },
    select: { courseId: true, lessons: { select: { id: true, contentRich: true, exercises: { select: { options: { select: { isCorrect: true } } } } } } },
  });

  const lessonIds: string[] = [];
  const lessonsWithMeta: Array<{
    id: string;
    hasContent: boolean;
    fullExercises: boolean;
  }> = [];

  for (const mod of modules) {
    for (const les of mod.lessons) {
      lessonIds.push(les.id);
      const text = stripHtmlRichText(les.contentRich);
      const hasContent = text.length >= MIN_RICH_TEXT_LENGTH;
      const validCount = les.exercises.filter((ex) => isValidExercise(ex.options)).length;
      const fullExercises = validCount >= EXERCISES_TARGET_PER_LESSON;
      lessonsWithMeta.push({ id: les.id, hasContent, fullExercises });
    }
  }

  const lessonsTotal = lessonsWithMeta.length;
  const lessonsWithContent = lessonsWithMeta.filter((l) => l.hasContent).length;
  const lessonsWithFiveExercises = lessonsWithMeta.filter((l) => l.fullExercises).length;

  const classGroupIds = groups.map((g) => g.id);
  const today = getBrazilTodayDateOnly();

  const pastSessions = await prisma.classSession.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      sessionDate: { lte: today },
    },
    select: { id: true, classGroupId: true },
  });

  const enrollmentsByGroup = await prisma.enrollment.groupBy({
    by: ["classGroupId"],
    where: { classGroupId: { in: classGroupIds }, status: "ACTIVE" },
    _count: { id: true },
  });
  const activeCountByGroup = new Map(enrollmentsByGroup.map((r) => [r.classGroupId, r._count.id]));

  const attendanceCounts = await prisma.sessionAttendance.groupBy({
    by: ["classSessionId"],
    where: { classSessionId: { in: pastSessions.map((s) => s.id) } },
    _count: { id: true },
  });
  const attendanceBySession = new Map(attendanceCounts.map((a) => [a.classSessionId, a._count.id]));

  // Contagem de alunos marcados como presentes (present=true) por sessão.
  const attendancePresentCounts = await prisma.sessionAttendance.groupBy({
    by: ["classSessionId"],
    where: { classSessionId: { in: pastSessions.map((s) => s.id) }, present: true },
    _count: { id: true },
  });
  const attendancePresentBySession = new Map(
    attendancePresentCounts.map((a) => [a.classSessionId, a._count.id])
  );

  let pastSessionsAttendanceComplete = 0;
  let presentStudentsTotal = 0;
  let presentStudentsMaxTotal = 0;
  for (const s of pastSessions) {
    const need = activeCountByGroup.get(s.classGroupId) ?? 0;
    if (need === 0) continue;
    const have = attendanceBySession.get(s.id) ?? 0;
    const present = attendancePresentBySession.get(s.id) ?? 0;
    if (have >= need) pastSessionsAttendanceComplete++;
    presentStudentsTotal += present;
    presentStudentsMaxTotal += need;
  }

  const teacherRepliesInScope =
    lessonIds.length === 0
      ? 0
      : await prisma.lessonQuestionTeacherReply.count({
          where: {
            teacherId,
            question: { lessonId: { in: lessonIds } },
          },
        });

  const enrollments = await prisma.enrollment.findMany({
    where: { classGroupId: { in: classGroupIds }, status: "ACTIVE" },
    select: { id: true, classGroup: { select: { courseId: true } } },
  });
  const enrollmentIds = enrollments.map((e) => e.id);

  const studentRepliesInScope =
    enrollmentIds.length === 0 || lessonIds.length === 0
      ? 0
      : await prisma.enrollmentLessonQuestionReply.count({
          where: {
            enrollmentId: { in: enrollmentIds },
            question: { lessonId: { in: lessonIds } },
          },
        });

  let studentTotalMinutesStudied = 0;
  let studentWatchHours = 0;
  let studentExerciseAttempts = 0;
  let studentExerciseCorrect = 0;

  if (enrollmentIds.length > 0 && lessonIds.length > 0) {
    const progressAgg = await prisma.enrollmentLessonProgress.aggregate({
      where: { enrollmentId: { in: enrollmentIds }, lessonId: { in: lessonIds } },
      _sum: { totalMinutesStudied: true },
    });
    studentTotalMinutesStudied = progressAgg._sum.totalMinutesStudied ?? 0;
    studentWatchHours = Math.round(studentTotalMinutesStudied / 60);

    studentExerciseAttempts = await prisma.enrollmentLessonExerciseAnswer.count({
      where: {
        enrollmentId: { in: enrollmentIds },
        exercise: { lessonId: { in: lessonIds } },
      },
    });
    studentExerciseCorrect = await prisma.enrollmentLessonExerciseAnswer.count({
      where: {
        enrollmentId: { in: enrollmentIds },
        exercise: { lessonId: { in: lessonIds } },
        correct: true,
      },
    });
  }

  const pointsStudentExerciseScore = studentExerciseAttempts + studentExerciseCorrect;

  const pointsContent = lessonsWithContent * GAMIFICATION_POINTS.contentPerLesson;
  const pointsExercises = lessonsWithFiveExercises * GAMIFICATION_POINTS.exercisesFullLesson;
  const pointsAttendance =
    pastSessionsAttendanceComplete * GAMIFICATION_POINTS.attendancePerSession +
    presentStudentsTotal * GAMIFICATION_POINTS.attendancePerPresentStudent;
  const rawForum =
    (teacherRepliesInScope + studentRepliesInScope) * GAMIFICATION_POINTS.forumPerReply;
  const pointsForum = rawForum;

  const points: TeacherGamificationPoints = {
    content: pointsContent,
    exercises: pointsExercises,
    attendance: pointsAttendance,
    forum: pointsForum,
    studentWatchHours,
    studentExerciseScore: pointsStudentExerciseScore,
    total:
      pointsContent +
      pointsExercises +
      pointsAttendance +
      pointsForum +
      studentWatchHours +
      pointsStudentExerciseScore,
  };

  const structuralTeacherMax =
    lessonsTotal * GAMIFICATION_POINTS.contentPerLesson +
    lessonsTotal * GAMIFICATION_POINTS.exercisesFullLesson +
    pastSessions.length * GAMIFICATION_POINTS.attendancePerSession +
    presentStudentsMaxTotal * GAMIFICATION_POINTS.attendancePerPresentStudent;
  const maxPointsEstimate = Math.max(
    1,
    points.total,
    structuralTeacherMax + pointsForum + studentWatchHours + pointsStudentExerciseScore
  );

  return {
    teacherId: teacher.id,
    teacherName: teacher.name,
    totals: {
      lessonsTotal,
      lessonsWithContent,
      lessonsWithFiveExercises,
      pastSessionsTotal: pastSessions.length,
      pastSessionsAttendanceComplete,
      teacherRepliesInScope,
      studentRepliesInScope,
      studentTotalMinutesStudied,
      studentWatchHours,
      studentExerciseAttempts,
      studentExerciseCorrect,
    },
    points,
    maxPointsEstimate: Math.max(1, maxPointsEstimate),
  };
}

/** Ranking de todos os professores ativos (Admin/Master). */
export async function computeAllTeachersGamification(): Promise<TeacherGamificationResult[]> {
  const teachers = await prisma.teacher.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  const out: TeacherGamificationResult[] = [];
  for (const t of teachers) {
    const g = await computeTeacherGamification(t.id);
    if (g) out.push(g);
  }
  out.sort((a, b) => b.points.total - a.points.total);
  return out;
}
