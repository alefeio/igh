import { describe, expect, it } from "vitest";

import { frequencyAbsenceLabels, splitAbsenceCounts } from "@/lib/enrollment-frequency-label";

describe("frequência na lista da turma", () => {
  it("separa falta sem justificativa de falta justificada", () => {
    const counts = splitAbsenceCounts([
      { enrollmentId: "a", absenceJustification: null },
      { enrollmentId: "a", absenceJustification: "  " },
      { enrollmentId: "a", absenceJustification: "Atestado" },
      { enrollmentId: "b", absenceJustification: "FJ" },
    ]);
    expect(counts.get("a")).toEqual({ unjustifiedAbsenceCount: 2, justifiedAbsenceCount: 1 });
    expect(counts.get("b")).toEqual({ unjustifiedAbsenceCount: 0, justifiedAbsenceCount: 1 });
  });

  it("nomeia as faltas para a busca ativa", () => {
    expect(frequencyAbsenceLabels({ unjustifiedAbsenceCount: 1, justifiedAbsenceCount: 1 })).toEqual({
      unjustified: "1 falta sem justificativa",
      justified: "1 falta justificada",
    });
    expect(frequencyAbsenceLabels({ unjustifiedAbsenceCount: 2, justifiedAbsenceCount: 3 })).toEqual({
      unjustified: "2 faltas sem justificativa",
      justified: "3 faltas justificadas",
    });
    expect(frequencyAbsenceLabels({ unjustifiedAbsenceCount: 0, justifiedAbsenceCount: 0 })).toEqual({
      unjustified: null,
      justified: null,
    });
  });
});
