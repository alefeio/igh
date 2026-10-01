export type ScoreAttempt = {
  enrollmentId: string;
  kind: "DIAGNOSTIC" | "FORMATIVE" | "FINAL" | "OTHER";
  scorePercent: number | null;
};

export type LearningGain = {
  available: boolean;
  initial: number | null;
  final: number | null;
  gain: number | null;
  comparedStudents: number;
  /**
   * Média das médias por aluno que entregou ao menos uma diagnóstica e uma final.
   * Várias provas do mesmo tipo no mesmo aluno viram uma média antes da comparação.
   * Quem fez só um dos tipos fica de fora. Formativa e Outra não entram.
   */
  rule: string;
};

const RULE =
  "Compara a média das provas finais com a média das diagnósticas, por aluno que entregou os dois tipos. O ganho é a diferença em pontos percentuais.";

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function learningGainFromAttempts(attempts: ScoreAttempt[]): LearningGain {
  const byStudent = new Map<string, { diagnostic: number[]; final: number[] }>();
  for (const attempt of attempts) {
    if (attempt.scorePercent == null) continue;
    if (attempt.kind !== "DIAGNOSTIC" && attempt.kind !== "FINAL") continue;
    const current = byStudent.get(attempt.enrollmentId) ?? { diagnostic: [], final: [] };
    if (attempt.kind === "DIAGNOSTIC") current.diagnostic.push(attempt.scorePercent);
    else current.final.push(attempt.scorePercent);
    byStudent.set(attempt.enrollmentId, current);
  }

  const paired = [...byStudent.values()].filter((row) => row.diagnostic.length > 0 && row.final.length > 0);
  if (paired.length === 0) {
    return { available: false, initial: null, final: null, gain: null, comparedStudents: 0, rule: RULE };
  }
  const initialMeans = paired.map((row) => mean(row.diagnostic));
  const finalMeans = paired.map((row) => mean(row.final));
  const initial = Math.round(mean(initialMeans));
  const finalScore = Math.round(mean(finalMeans));
  return {
    available: true,
    initial,
    final: finalScore,
    gain: finalScore - initial,
    comparedStudents: paired.length,
    rule: RULE,
  };
}
