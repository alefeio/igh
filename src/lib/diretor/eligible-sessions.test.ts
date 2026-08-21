import { describe, expect, it } from "vitest";

import {
  assessSessionQuality,
  filterEligibleSessionsForEnrollment,
  isSessionReleasedAndDue,
  type SessionLike,
} from "@/lib/diretor/eligible-sessions";
import {
  aggregateOpportunityRates,
  computeOpportunityRates,
  countUnjustifiedStreakEligible,
  hasStarted,
} from "@/lib/diretor/metrics/attendance-formulas";
import { formatSensitiveCount, MIN_AGGREGATE_GROUP_SIZE } from "@/lib/diretor/lgpd";
import { CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT } from "@/lib/enrollment-attendance-streak";

function session(
  partial: Partial<SessionLike> & Pick<SessionLike, "id" | "status" | "sessionDate">,
): SessionLike {
  return {
    classGroupId: "cg1",
    startTime: "09:00",
    ...partial,
  };
}

describe("eligible sessions (canonical)", () => {
  const dataAsOf = new Date("2026-08-21T15:00:00.000Z");

  it("aceita apenas LIBERADA com instante ≤ dataAsOf", () => {
    const ok = session({
      id: "s1",
      status: "LIBERADA",
      sessionDate: new Date("2026-08-20T00:00:00.000Z"),
    });
    const scheduled = session({
      id: "s2",
      status: "SCHEDULED",
      sessionDate: new Date("2026-08-20T00:00:00.000Z"),
    });
    const future = session({
      id: "s3",
      status: "LIBERADA",
      sessionDate: new Date("2026-08-22T00:00:00.000Z"),
    });
    const canceled = session({
      id: "s4",
      status: "CANCELED",
      sessionDate: new Date("2026-08-20T00:00:00.000Z"),
    });

    expect(isSessionReleasedAndDue(ok, dataAsOf)).toBe(true);
    expect(isSessionReleasedAndDue(scheduled, dataAsOf)).toBe(false);
    expect(isSessionReleasedAndDue(future, dataAsOf)).toBe(false);
    expect(isSessionReleasedAndDue(canceled, dataAsOf)).toBe(false);
  });

  it("sinaliza qualidade para sessões passadas não liberadas", () => {
    const q = assessSessionQuality(
      [
        session({
          id: "s1",
          status: "SCHEDULED",
          sessionDate: new Date("2026-08-10T00:00:00.000Z"),
        }),
      ],
      dataAsOf,
    );
    expect(q.pastNotReleasedCount).toBe(1);
  });

  it("respeita data de entrada do aluno", () => {
    const sessions = [
      session({
        id: "s1",
        status: "LIBERADA",
        sessionDate: new Date("2026-08-01T00:00:00.000Z"),
      }),
      session({
        id: "s2",
        status: "LIBERADA",
        sessionDate: new Date("2026-08-15T00:00:00.000Z"),
      }),
    ];
    const eligible = filterEligibleSessionsForEnrollment(
      sessions,
      {
        id: "e1",
        classGroupId: "cg1",
        enteredAt: new Date("2026-08-10T00:00:00.000Z"),
      },
      dataAsOf,
      "asc",
    );
    expect(eligible.map((s) => s.id)).toEqual(["s2"]);
  });
});

describe("opportunity rates", () => {
  const dataAsOf = new Date("2026-08-21T15:00:00.000Z");
  const enrollment = {
    id: "e1",
    classGroupId: "cg1",
    enteredAt: new Date("2026-08-01T00:00:00.000Z"),
  };
  const sessions = [
    session({
      id: "s1",
      status: "LIBERADA",
      sessionDate: new Date("2026-08-05T00:00:00.000Z"),
    }),
    session({
      id: "s2",
      status: "LIBERADA",
      sessionDate: new Date("2026-08-12T00:00:00.000Z"),
    }),
    session({
      id: "s3",
      status: "LIBERADA",
      sessionDate: new Date("2026-08-19T00:00:00.000Z"),
    }),
  ];

  it("usa oportunidades aluno×sessão como denominador compartilhado", () => {
    const att = new Map([
      ["s1", { classSessionId: "s1", present: true, absenceJustification: null }],
      ["s2", { classSessionId: "s2", present: false, absenceJustification: "Atestado" }],
      ["s3", { classSessionId: "s3", present: false, absenceJustification: null }],
    ]);
    const rates = computeOpportunityRates(enrollment, sessions, att, dataAsOf);
    expect(rates.opportunities).toBe(3);
    expect(rates.presentCount).toBe(1);
    expect(rates.justifiedCount).toBe(1);
    expect(rates.unjustifiedCount).toBe(1);
    expect(rates.presentRate).toBeCloseTo(33.3, 0);
    expect(rates.justifiedRate).toBeCloseTo(33.3, 0);
    expect(rates.unjustifiedRate).toBeCloseTo(33.3, 0);
  });

  it("justificada permanece no denominador da presença", () => {
    const att = new Map([
      ["s1", { classSessionId: "s1", present: false, absenceJustification: "J" }],
    ]);
    const rates = computeOpportunityRates(
      enrollment,
      [sessions[0]],
      att,
      dataAsOf,
    );
    expect(rates.opportunities).toBe(1);
    expect(rates.presentCount).toBe(0);
    expect(rates.presentRate).toBe(0);
  });

  it("agrega taxas sem zerar quando denom=0 em um aluno", () => {
    const empty = computeOpportunityRates(
      enrollment,
      [],
      new Map(),
      dataAsOf,
    );
    const full = computeOpportunityRates(
      enrollment,
      [sessions[0]],
      new Map([["s1", { classSessionId: "s1", present: true, absenceJustification: null }]]),
      dataAsOf,
    );
    const agg = aggregateOpportunityRates([empty, full]);
    expect(agg.opportunities).toBe(1);
    expect(agg.presentRate).toBe(100);
  });

  it("streak crítico usa sessões elegíveis", () => {
    const att = new Map([
      ["s1", { classSessionId: "s1", present: false, absenceJustification: null }],
      ["s2", { classSessionId: "s2", present: false, absenceJustification: null }],
      ["s3", { classSessionId: "s3", present: false, absenceJustification: null }],
      [
        "s4",
        {
          classSessionId: "s4",
          present: false,
          absenceJustification: null,
        },
      ],
    ]);
    const four = [
      ...sessions,
      session({
        id: "s4",
        status: "LIBERADA",
        sessionDate: new Date("2026-08-20T00:00:00.000Z"),
      }),
    ];
    const streak = countUnjustifiedStreakEligible(enrollment, four, att, dataAsOf);
    expect(streak).toBeGreaterThanOrEqual(CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT);
    expect(hasStarted(enrollment, four, att, dataAsOf)).toBe(false);
  });
});

describe("lgpd aggregate", () => {
  it("formata grupos pequenos", () => {
    expect(MIN_AGGREGATE_GROUP_SIZE).toBe(5);
    expect(formatSensitiveCount(3)).toBe("<5");
    expect(formatSensitiveCount(5)).toBe("5");
  });
});

describe("director auth policy (unit)", () => {
  it("documenta papéis permitidos na área", () => {
    const allowed = new Set(["DIRECTOR", "MASTER"]);
    expect(allowed.has("DIRECTOR")).toBe(true);
    expect(allowed.has("MASTER")).toBe(true);
    expect(allowed.has("ADMIN_MANAGER")).toBe(false);
  });
});
