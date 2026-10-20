import { describe, expect, it } from "vitest";

import { sessionCountsForEnrollment } from "@/lib/enrollment-session-window";

describe("aula conta só a partir do dia da matrícula", () => {
  it("aula de ontem não é falta de quem se matriculou hoje", () => {
    const session = new Date("2026-10-19T00:00:00.000Z");
    const enrolled = new Date("2026-10-20T15:00:00.000Z");
    expect(sessionCountsForEnrollment(session, enrolled)).toBe(false);
  });

  it("aula do mesmo dia da matrícula conta, mesmo se o horário da aula foi mais cedo", () => {
    const session = new Date("2026-10-20T00:00:00.000Z");
    const enrolled = new Date("2026-10-20T18:00:00.000Z");
    expect(sessionCountsForEnrollment(session, enrolled)).toBe(true);
  });

  it("usa o dia em Brasília, não a data UTC da matrícula", () => {
    const enrolled = new Date("2026-10-20T02:30:00.000Z");
    expect(sessionCountsForEnrollment(new Date("2026-10-18T00:00:00.000Z"), enrolled)).toBe(false);
    expect(sessionCountsForEnrollment(new Date("2026-10-19T00:00:00.000Z"), enrolled)).toBe(true);
  });
});
