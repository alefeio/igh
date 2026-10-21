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

/** Fora da coordenação, a listagem omite mensagens anônimas. */
export function teacherClassEvaluationListWhere(
  teacherId?: string,
  options?: { includeAnonymous?: boolean },
): { teacherId?: string; anonymous?: false } {
  return {
    ...(teacherId ? { teacherId } : {}),
    ...(options?.includeAnonymous ? {} : { anonymous: false }),
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
