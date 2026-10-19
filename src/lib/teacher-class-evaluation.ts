export const TEACHER_EVALUATION_COMMENT_MAX = 2000;

export type TeacherClassEvaluationInput = {
  rating: number;
  comment: string | null;
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
  let comment: string | null = null;
  if (raw.comment != null) {
    if (typeof raw.comment !== "string") {
      return { ok: false, message: "O comentário precisa ser um texto." };
    }
    const trimmed = raw.comment.trim();
    if (trimmed.length > TEACHER_EVALUATION_COMMENT_MAX) {
      return { ok: false, message: "O comentário passou do limite de 2000 caracteres." };
    }
    comment = trimmed || null;
  }
  return { ok: true, value: { rating, comment, anonymous: raw.anonymous } };
}

/** Nome exibido na listagem. Avaliação anônima não revela o aluno. */
export function teacherEvaluationAuthorLabel(anonymous: boolean, studentName: string | null | undefined): string {
  if (anonymous) return "Anônimo";
  const name = studentName?.trim();
  return name || "Aluno";
}
