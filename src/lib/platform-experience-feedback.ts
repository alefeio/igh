/** Médias exibidas no painel / APIs (1 casa decimal). */
export function formatExperienceAvg(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 10) / 10;
}

/** Texto único para PDF / export (professores + comentário). */
export function formatExperienceTeacherComment(
  teacherNames: string[],
  commentTeacher: string | null,
): string {
  const ct = commentTeacher?.trim();
  if (!ct) return "—";
  if (teacherNames.length > 0) return `${teacherNames.join(", ")} — ${ct}`;
  return ct;
}

export function parseRating1to10(raw: unknown): number | null {
  const n =
    typeof raw === "number" && Number.isInteger(raw)
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 10) return null;
  return n;
}
