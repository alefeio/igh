import { describe, expect, it } from "vitest";

import {
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
  countConsecutiveUnjustifiedAbsenceStreak,
  wouldCancelEnrollmentOnFourthAbsence,
} from "@/lib/enrollment-attendance-streak";

const sessions = [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }];

describe("enrollment-attendance-streak", () => {
  it("limite de cancelamento é 4 faltas consecutivas não justificadas", () => {
    expect(CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT).toBe(4);
  });

  it("conta streak da aula mais recente para trás e ignora sessão sem lançamento", () => {
    const bySession = new Map([
      ["s4", { present: false, absenceJustification: null }],
      ["s3", { present: false, absenceJustification: null }],
      ["s1", { present: false, absenceJustification: null }],
    ]);
    const newestFirst = [...sessions].reverse();
    expect(countConsecutiveUnjustifiedAbsenceStreak(newestFirst, bySession)).toBe(3);
  });

  it("4ª falta em matrícula suspensa dispara cancelamento", () => {
    expect(
      wouldCancelEnrollmentOnFourthAbsence({
        enrollmentStatus: "SUSPENDED",
        sessionsOldestFirst: sessions,
        cells: { s1: "F", s2: "F", s3: "F", s4: null },
        sessionId: "s4",
        next: "F",
      }),
    ).toBe(true);
  });

  it("não cancela se ainda ACTIVE (3ª falta é suspensão)", () => {
    expect(
      wouldCancelEnrollmentOnFourthAbsence({
        enrollmentStatus: "ACTIVE",
        sessionsOldestFirst: sessions,
        cells: { s1: "F", s2: "F", s3: "F", s4: null },
        sessionId: "s4",
        next: "F",
      }),
    ).toBe(false);
  });

  it("falta justificada não conta para cancelamento", () => {
    expect(
      wouldCancelEnrollmentOnFourthAbsence({
        enrollmentStatus: "SUSPENDED",
        sessionsOldestFirst: sessions,
        cells: { s1: "F", s2: "F", s3: "J", s4: null },
        sessionId: "s4",
        next: "F",
      }),
    ).toBe(false);
  });
});
