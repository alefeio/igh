import { describe, expect, it } from "vitest";

import { CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT } from "@/lib/enrollment-attendance-streak";
import type { SessionLike } from "@/lib/diretor/eligible-sessions";
import {
  aggregateOpportunityRates,
  classifyCriticalAbsenceRisk,
  completionStartedRate,
  computeOpportunityRates,
  countUnjustifiedStreakEligible,
  hasStarted,
} from "@/lib/diretor/metrics/attendance-formulas";

function session(
  partial: Partial<SessionLike> & Pick<SessionLike, "id" | "status" | "sessionDate">,
): SessionLike {
  return { classGroupId: "cg1", startTime: "09:00", ...partial };
}

const dataAsOf = new Date("2026-08-21T15:00:00.000Z");
const enrollment = {
  id: "e1",
  classGroupId: "cg1",
  enteredAt: new Date("2026-08-01T00:00:00.000Z"),
};

const sessions = [
  session({ id: "s1", status: "LIBERADA", sessionDate: new Date("2026-08-05T00:00:00.000Z") }),
  session({ id: "s2", status: "LIBERADA", sessionDate: new Date("2026-08-12T00:00:00.000Z") }),
  session({ id: "s3", status: "LIBERADA", sessionDate: new Date("2026-08-19T00:00:00.000Z") }),
];

describe("frequência — oportunidades", () => {
  it("falta justificada permanece no denominador e não é presença", () => {
    const rates = computeOpportunityRates(
      enrollment,
      [sessions[0]],
      new Map([["s1", { classSessionId: "s1", present: false, absenceJustification: "Atestado" }]]),
      dataAsOf,
    );
    expect(rates.opportunities).toBe(1);
    expect(rates.justifiedCount).toBe(1);
    expect(rates.presentRate).toBe(0);
    expect(rates.justifiedRate).toBe(100);
  });

  it("falta não justificada", () => {
    const rates = computeOpportunityRates(
      enrollment,
      [sessions[0]],
      new Map([["s1", { classSessionId: "s1", present: false, absenceJustification: null }]]),
      dataAsOf,
    );
    expect(rates.unjustifiedCount).toBe(1);
    expect(rates.unjustifiedRate).toBe(100);
  });

  it("denominador zero → taxas null e quality unavailable", () => {
    const rates = computeOpportunityRates(enrollment, [], new Map(), dataAsOf);
    expect(rates.opportunities).toBe(0);
    expect(rates.presentRate).toBeNull();
    expect(rates.quality).toBe("unavailable");
  });

  it("oportunidade sem registro NÃO vira falta; qualidade partial + completude", () => {
    const rates = computeOpportunityRates(
      enrollment,
      sessions,
      new Map([["s1", { classSessionId: "s1", present: true, absenceJustification: null }]]),
      dataAsOf,
    );
    expect(rates.unmarkedCount).toBe(2);
    expect(rates.unjustifiedCount).toBe(0);
    expect(rates.justifiedCount).toBe(0);
    expect(rates.opportunities).toBe(3);
    expect(rates.presentCount).toBe(1);
    expect(rates.callCompletenessRate).toBeCloseTo(33.3, 0);
    expect(rates.quality).toBe("partial");
  });

  it("agregação preserva unmarked e não inventa zero enganoso com denom 0", () => {
    const empty = computeOpportunityRates(enrollment, [], new Map(), dataAsOf);
    const one = computeOpportunityRates(
      enrollment,
      [sessions[0]],
      new Map([["s1", { classSessionId: "s1", present: true, absenceJustification: null }]]),
      dataAsOf,
    );
    const agg = aggregateOpportunityRates([empty, one]);
    expect(agg.opportunities).toBe(1);
    expect(agg.presentRate).toBe(100);
  });

  it("frequência e streak usam as mesmas sessões elegíveis", () => {
    const att = new Map([
      ["s1", { classSessionId: "s1", present: false, absenceJustification: null }],
      ["s2", { classSessionId: "s2", present: false, absenceJustification: null }],
      ["s3", { classSessionId: "s3", present: false, absenceJustification: null }],
    ]);
    const rates = computeOpportunityRates(enrollment, sessions, att, dataAsOf);
    const streak = countUnjustifiedStreakEligible(enrollment, sessions, att, dataAsOf);
    expect(rates.opportunities).toBe(3);
    expect(streak).toBe(3);
  });

  it("chamada incompleta no meio não zera nem incrementa streak", () => {
    const att = new Map([
      ["s1", { classSessionId: "s1", present: false, absenceJustification: null }],
      // s2 sem registro
      ["s3", { classSessionId: "s3", present: false, absenceJustification: null }],
    ]);
    // newest first: s3 F, s2 unmarked (skip), s1 F → streak continua
    expect(countUnjustifiedStreakEligible(enrollment, sessions, att, dataAsOf)).toBe(2);
  });
});

describe("indicadores acadêmicos (regras)", () => {
  it("streak 3 não é risco crítico / não é evasão", () => {
    expect(
      classifyCriticalAbsenceRisk({
        status: "ACTIVE",
        streak: 3,
        cancelLimit: CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
      }),
    ).toBe("none");
  });

  it("streak 4 em vinculado gera risco crítico", () => {
    expect(
      classifyCriticalAbsenceRisk({
        status: "SUSPENDED",
        streak: 4,
        cancelLimit: CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
      }),
    ).toBe("critical_linked");
  });

  it("suspensão/risco não são evasão confirmada (função só classifica risco)", () => {
    expect(
      classifyCriticalAbsenceRisk({
        status: "CANCELLED",
        streak: 10,
        cancelLimit: 4,
      }),
    ).toBe("none");
  });

  it("conclusão só em turma ENCERRADA e só quem iniciou no denominador", () => {
    expect(
      completionStartedRate({
        classGroupStatus: "EM_ANDAMENTO",
        startedCount: 10,
        completedStartedCount: 5,
      }),
    ).toBeNull();
    expect(
      completionStartedRate({
        classGroupStatus: "ENCERRADA",
        startedCount: 0,
        completedStartedCount: 0,
      }),
    ).toBeNull();
    expect(
      completionStartedRate({
        classGroupStatus: "ENCERRADA",
        startedCount: 10,
        completedStartedCount: 5,
      }),
    ).toBe(50);
  });

  it("beneficiário sem presença não iniciou; com presença iniciou", () => {
    expect(hasStarted(enrollment, sessions, new Map(), dataAsOf)).toBe(false);
    expect(
      hasStarted(
        enrollment,
        sessions,
        new Map([["s2", { classSessionId: "s2", present: true, absenceJustification: null }]]),
        dataAsOf,
      ),
    ).toBe(true);
  });

  it("periodo sem dados → não calculável (null), não zero", () => {
    const rates = computeOpportunityRates(enrollment, [], new Map(), dataAsOf);
    expect(rates.presentRate).toBeNull();
    expect(rates.presentRate === 0).toBe(false);
  });
});
