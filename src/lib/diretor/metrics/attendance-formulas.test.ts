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
  INCOMPLETE_CALL_ALERT,
  isExecutiveAttendanceReliable,
  shouldEmitExecutiveAttendanceAlerts,
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

  it("chamada incompleta no meio interrompe o streak comprovado", () => {
    const att = new Map([
      ["s1", { classSessionId: "s1", present: false, absenceJustification: null }],
      // s2 sem registro
      ["s3", { classSessionId: "s3", present: false, absenceJustification: null }],
    ]);
    expect(countUnjustifiedStreakEligible(enrollment, sessions, att, dataAsOf)).toBe(1);
  });
});

describe("streak com sessões desconhecidas", () => {
  const s4 = session({ id: "s4", status: "LIBERADA", sessionDate: new Date("2026-08-20T00:00:00.000Z") });
  const four = [
    session({ id: "s1", status: "LIBERADA", sessionDate: new Date("2026-08-05T00:00:00.000Z") }),
    session({ id: "s2", status: "LIBERADA", sessionDate: new Date("2026-08-12T00:00:00.000Z") }),
    session({ id: "s3", status: "LIBERADA", sessionDate: new Date("2026-08-19T00:00:00.000Z") }),
    s4,
  ];
  const F = (id: string): [string, { classSessionId: string; present: boolean; absenceJustification: string | null }] => [
    id,
    { classSessionId: id, present: false, absenceJustification: null },
  ];
  const P = (id: string): [string, { classSessionId: string; present: boolean; absenceJustification: string | null }] => [
    id,
    { classSessionId: id, present: true, absenceJustification: null },
  ];

  it("quatro faltas liberadas realmente consecutivas", () => {
    const att = new Map([F("s1"), F("s2"), F("s3"), F("s4")]);
    expect(countUnjustifiedStreakEligible(enrollment, four, att, dataAsOf)).toBe(4);
  });

  it("duas faltas, sessão não liberada e mais duas faltas não são um único streak", () => {
    const mixed = [
      session({ id: "s1", status: "LIBERADA", sessionDate: new Date("2026-08-05T00:00:00.000Z") }),
      session({ id: "s2", status: "LIBERADA", sessionDate: new Date("2026-08-12T00:00:00.000Z") }),
      session({ id: "s3", status: "SCHEDULED", sessionDate: new Date("2026-08-19T00:00:00.000Z") }),
      s4,
      session({ id: "s5", status: "LIBERADA", sessionDate: new Date("2026-08-21T00:00:00.000Z") }),
    ];
    const att = new Map([F("s1"), F("s2"), F("s4"), F("s5")]);
    expect(countUnjustifiedStreakEligible(enrollment, mixed, att, dataAsOf)).toBe(2);
  });

  it("sessão desconhecida que posteriormente vira presença zera o streak", () => {
    const mixed = [
      ...sessions,
      session({ id: "sx", status: "LIBERADA", sessionDate: new Date("2026-08-20T00:00:00.000Z") }),
    ];
    const attUnknown = new Map([F("s1"), F("s2")]);
    expect(countUnjustifiedStreakEligible(enrollment, mixed, attUnknown, dataAsOf)).toBe(0);
    const attPresent = new Map([F("s1"), F("s2"), P("sx")]);
    expect(countUnjustifiedStreakEligible(enrollment, mixed, attPresent, dataAsOf)).toBe(0);
  });

  it("sessão desconhecida que posteriormente vira falta entra no streak", () => {
    const mixed = [
      session({ id: "s1", status: "LIBERADA", sessionDate: new Date("2026-08-05T00:00:00.000Z") }),
      session({ id: "sx", status: "SCHEDULED", sessionDate: new Date("2026-08-12T00:00:00.000Z") }),
    ];
    expect(countUnjustifiedStreakEligible(enrollment, mixed, new Map([F("s1")]), dataAsOf)).toBe(0);
    const released = [
      session({ id: "s1", status: "LIBERADA", sessionDate: new Date("2026-08-05T00:00:00.000Z") }),
      session({ id: "sx", status: "LIBERADA", sessionDate: new Date("2026-08-12T00:00:00.000Z") }),
    ];
    expect(countUnjustifiedStreakEligible(enrollment, released, new Map([F("s1"), F("sx")]), dataAsOf)).toBe(2);
  });

  it("múltiplas lacunas: só o trecho mais recente sem gap conta", () => {
    const many = [
      session({ id: "a", status: "LIBERADA", sessionDate: new Date("2026-08-01T00:00:00.000Z") }),
      session({ id: "b", status: "SCHEDULED", sessionDate: new Date("2026-08-05T00:00:00.000Z") }),
      session({ id: "c", status: "LIBERADA", sessionDate: new Date("2026-08-12T00:00:00.000Z") }),
      session({ id: "d", status: "SCHEDULED", sessionDate: new Date("2026-08-15T00:00:00.000Z") }),
      session({ id: "e", status: "LIBERADA", sessionDate: new Date("2026-08-19T00:00:00.000Z") }),
    ];
    const att = new Map([F("a"), F("c"), F("e")]);
    expect(countUnjustifiedStreakEligible(enrollment, many, att, dataAsOf)).toBe(1);
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

describe("limiar executivo de completude da chamada", () => {
  it("89,9% é provisório; 90% e 100% são confiáveis", () => {
    expect(isExecutiveAttendanceReliable(89.9)).toBe(false);
    expect(shouldEmitExecutiveAttendanceAlerts(89.9)).toBe(false);
    expect(isExecutiveAttendanceReliable(90)).toBe(true);
    expect(shouldEmitExecutiveAttendanceAlerts(90)).toBe(true);
    expect(isExecutiveAttendanceReliable(100)).toBe(true);
    expect(shouldEmitExecutiveAttendanceAlerts(100)).toBe(true);
    expect(INCOMPLETE_CALL_ALERT.fact).toBe(
      "Chamadas incompletas impedem uma leitura confiável da frequência.",
    );
    expect(INCOMPLETE_CALL_ALERT.suggestedDecision).toBe(
      "Solicitar a regularização das chamadas antes de avaliar a frequência.",
    );
  });
});
