import { describe, expect, it } from "vitest";

import {
  assessSessionQuality,
  filterEligibleSessionsForEnrollment,
  isSessionReleasedAndDue,
  type SessionLike,
} from "@/lib/diretor/eligible-sessions";

function session(
  partial: Partial<SessionLike> & Pick<SessionLike, "id" | "status" | "sessionDate">,
): SessionLike {
  return {
    classGroupId: "cg1",
    startTime: "09:00",
    ...partial,
  };
}

describe("sessões elegíveis canônicas", () => {
  const dataAsOf = new Date("2026-08-21T12:00:00.000Z");

  it("LIBERADA passada é elegível", () => {
    expect(
      isSessionReleasedAndDue(
        session({
          id: "s1",
          status: "LIBERADA",
          sessionDate: new Date("2026-08-20T00:00:00.000Z"),
        }),
        dataAsOf,
      ),
    ).toBe(true);
  });

  it("sessão futura LIBERADA não é elegível", () => {
    expect(
      isSessionReleasedAndDue(
        session({
          id: "s1",
          status: "LIBERADA",
          sessionDate: new Date("2026-08-22T00:00:00.000Z"),
          startTime: "08:00",
        }),
        dataAsOf,
      ),
    ).toBe(false);
  });

  it("SCHEDULED passada não é elegível e aparece na qualidade", () => {
    const s = session({
      id: "s1",
      status: "SCHEDULED",
      sessionDate: new Date("2026-08-10T00:00:00.000Z"),
    });
    expect(isSessionReleasedAndDue(s, dataAsOf)).toBe(false);
    const q = assessSessionQuality([s], dataAsOf);
    expect(q.pastNotReleasedCount).toBe(1);
  });

  it("CANCELED nunca é elegível", () => {
    expect(
      isSessionReleasedAndDue(
        session({
          id: "s1",
          status: "CANCELED",
          sessionDate: new Date("2026-08-10T00:00:00.000Z"),
        }),
        dataAsOf,
      ),
    ).toBe(false);
  });

  it("aluno matriculado depois da sessão não a recebe", () => {
    const sessions = [
      session({
        id: "before",
        status: "LIBERADA",
        sessionDate: new Date("2026-08-01T00:00:00.000Z"),
      }),
      session({
        id: "after",
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
    expect(eligible.map((x) => x.id)).toEqual(["after"]);
  });

  it("limite exato de dataAsOf: sessão no mesmo instante é elegível", () => {
    const exact = new Date("2026-08-21T09:00:00.000Z");
    const s = session({
      id: "edge",
      status: "LIBERADA",
      sessionDate: new Date("2026-08-21T00:00:00.000Z"),
      startTime: "09:00",
    });
    expect(isSessionReleasedAndDue(s, exact)).toBe(true);
    expect(isSessionReleasedAndDue(s, new Date(exact.getTime() - 1))).toBe(false);
  });

  it("documenta interpretação de horário (startTime aplicado sobre sessionDate UTC)", () => {
    // Datas @db.Date chegam como meia-noite UTC; startTime é horário de aula.
    // A regra canônica compara o instante composto com dataAsOf (mesmo critério em freq./streak).
    const s = session({
      id: "tz",
      status: "LIBERADA",
      sessionDate: new Date("2026-08-21T00:00:00.000Z"),
      startTime: "14:00",
    });
    expect(isSessionReleasedAndDue(s, new Date("2026-08-21T13:59:00.000Z"))).toBe(false);
    expect(isSessionReleasedAndDue(s, new Date("2026-08-21T14:00:00.000Z"))).toBe(true);
  });
});
