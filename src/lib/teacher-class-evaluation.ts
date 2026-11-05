export const TEACHER_EVALUATION_COMMENT_MAX = 2000;

export type TeacherClassEvaluationInput = {
  rating: number;
  comment: string;
  anonymous: boolean;
};

export function parseTeacherClassEvaluationBody(
  body: unknown,
): { ok: true; value: TeacherClassEvaluationInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Dados inválidos." };
  }
  const raw = body as { rating?: unknown; comment?: unknown; anonymous?: unknown };
  const rating = typeof raw.rating === "number" ? raw.rating : Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: "Escolha uma nota de 1 a 5." };
  }
  if (raw.anonymous !== true && raw.anonymous !== false) {
    return { ok: false, message: "Informe se a avaliação é anônima." };
  }
  if (raw.comment != null && typeof raw.comment !== "string") {
    return { ok: false, message: "O comentário precisa ser um texto." };
  }
  const comment = typeof raw.comment === "string" ? raw.comment.trim() : "";
  if (!comment) {
    return { ok: false, message: "Escreva um comentário antes de enviar." };
  }
  if (comment.length > TEACHER_EVALUATION_COMMENT_MAX) {
    return { ok: false, message: "O comentário passou do limite de 2000 caracteres." };
  }
  return { ok: true, value: { rating, comment, anonymous: raw.anonymous } };
}

/**
 * Nome exibido na listagem.
 * Anônimo esconde o aluno do professor. A coordenação recebe o nome mesmo nesse caso.
 */
/**
 * O aviso do painel abre quando ainda não há avaliação, o aluno não dispensou o lembrete
 * e já existe ao menos uma presença registrada em aula.
 */
export function enrollmentNeedsTeacherEvaluationPrompt(input: {
  hasEvaluation: boolean;
  reminderDismissedAt: Date | string | null;
  hasRecordedPresence: boolean;
}): boolean {
  return input.hasRecordedPresence && !input.hasEvaluation && input.reminderDismissedAt == null;
}

export type TeacherEvaluationScopeFilter = "all" | "internal" | "external";

/** Mesmos recortes do painel da coordenação (ciclo, curso, professor, turma, tipo). */
export type TeacherEvaluationListFilter = {
  cycleId?: string | null;
  courseId?: string | null;
  classGroupId?: string | null;
  teacherId?: string | null;
  scope?: TeacherEvaluationScopeFilter | null;
};

/** Filtro da matrícula/turma. Alinha com `loadCoordinatorSnapshot`. */
export function teacherEvaluationClassGroupWhere(filter: TeacherEvaluationListFilter = {}) {
  const classGroup: {
    cycleId?: string;
    courseId?: string;
    id?: string;
    teacherId?: string;
    isExternal?: boolean;
  } = {};
  if (filter.cycleId) classGroup.cycleId = filter.cycleId;
  if (filter.courseId) classGroup.courseId = filter.courseId;
  if (filter.classGroupId) classGroup.id = filter.classGroupId;
  if (filter.teacherId) classGroup.teacherId = filter.teacherId;
  if (filter.scope === "external") classGroup.isExternal = true;
  if (filter.scope === "internal") classGroup.isExternal = false;
  if (Object.keys(classGroup).length === 0) return {};
  return { enrollment: { classGroup } };
}

export function parseTeacherEvaluationListFilter(
  params: URLSearchParams | { get(name: string): string | null },
): TeacherEvaluationListFilter {
  const scopeRaw = params.get("scope");
  return {
    cycleId: params.get("cycleId"),
    courseId: params.get("courseId"),
    classGroupId: params.get("classGroupId"),
    teacherId: params.get("teacherId"),
    scope: scopeRaw === "internal" || scopeRaw === "external" ? scopeRaw : "all",
  };
}

/** Fora da coordenação, a listagem omite mensagens anônimas. */
export function teacherClassEvaluationListWhere(
  teacherId?: string,
  options?: { includeAnonymous?: boolean; filter?: TeacherEvaluationListFilter },
): {
  teacherId?: string;
  anonymous?: false;
  enrollment?: { classGroup: { cycleId?: string; courseId?: string; id?: string; teacherId?: string; isExternal?: boolean } };
} {
  return {
    ...(teacherId ? { teacherId } : {}),
    ...(options?.includeAnonymous ? {} : { anonymous: false }),
    ...teacherEvaluationClassGroupWhere(options?.filter),
  };
}

export function teacherEvaluationAuthorLabel(
  anonymous: boolean,
  studentName: string | null | undefined,
  options?: { revealIdentity?: boolean },
): string {
  const name = studentName?.trim() || "Aluno";
  if (anonymous && !options?.revealIdentity) return "Anônimo";
  return name;
}

export type PublicTeacherEvaluationRanking = {
  teacherId: string;
  teacherName: string;
  averageRating: number;
  evaluationCount: number;
  latest: {
    rating: number;
    comment: string;
    authorLabel: string;
    courseName: string;
    classLabel: string;
    at: string;
  };
};

/** Ranking pela média das avaliações públicas. A primeira de cada professor, já ordenada da mais recente, é a última pública. */
export function buildPublicTeacherEvaluationRanking(
  rows: {
    teacherId: string;
    teacherName: string;
    rating: number;
    comment: string;
    at: string;
    authorLabel: string;
    courseName: string;
    classLabel: string;
  }[],
): PublicTeacherEvaluationRanking[] {
  const byTeacher = new Map<string, PublicTeacherEvaluationRanking & { ratingSum: number }>();
  const ordered = [...rows].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  for (const row of ordered) {
    const current = byTeacher.get(row.teacherId);
    if (!current) {
      byTeacher.set(row.teacherId, {
        teacherId: row.teacherId,
        teacherName: row.teacherName.trim() || "Professor",
        averageRating: row.rating,
        evaluationCount: 1,
        ratingSum: row.rating,
        latest: {
          rating: row.rating,
          comment: row.comment.trim(),
          authorLabel: row.authorLabel,
          courseName: row.courseName,
          classLabel: row.classLabel,
          at: row.at,
        },
      });
      continue;
    }
    current.evaluationCount += 1;
    current.ratingSum += row.rating;
  }
  return [...byTeacher.values()]
    .map((row) => ({
      teacherId: row.teacherId,
      teacherName: row.teacherName,
      averageRating: Math.round((row.ratingSum / row.evaluationCount) * 10) / 10,
      evaluationCount: row.evaluationCount,
      latest: row.latest,
    }))
    .sort(
      (a, b) =>
        b.averageRating - a.averageRating ||
        b.evaluationCount - a.evaluationCount ||
        a.teacherName.localeCompare(b.teacherName, "pt-BR"),
    );
}
