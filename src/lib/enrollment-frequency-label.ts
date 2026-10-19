/** Separa faltas lançadas: com texto de justificativa e sem justificativa. */
export function splitAbsenceCounts(
  rows: { enrollmentId: string; absenceJustification: string | null }[],
): Map<string, { justifiedAbsenceCount: number; unjustifiedAbsenceCount: number }> {
  const map = new Map<string, { justifiedAbsenceCount: number; unjustifiedAbsenceCount: number }>();
  for (const row of rows) {
    const current = map.get(row.enrollmentId) ?? {
      justifiedAbsenceCount: 0,
      unjustifiedAbsenceCount: 0,
    };
    if ((row.absenceJustification ?? "").trim().length > 0) current.justifiedAbsenceCount += 1;
    else current.unjustifiedAbsenceCount += 1;
    map.set(row.enrollmentId, current);
  }
  return map;
}

export function frequencyAbsenceLabels(counts: {
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
}): { unjustified: string | null; justified: string | null } {
  const unjustifiedCount = counts.unjustifiedAbsenceCount;
  const justifiedCount = counts.justifiedAbsenceCount;
  return {
    unjustified:
      unjustifiedCount === 0
        ? null
        : unjustifiedCount === 1
          ? "1 falta sem justificativa"
          : `${unjustifiedCount} faltas sem justificativa`,
    justified:
      justifiedCount === 0
        ? null
        : justifiedCount === 1
          ? "1 falta justificada"
          : `${justifiedCount} faltas justificadas`,
  };
}
