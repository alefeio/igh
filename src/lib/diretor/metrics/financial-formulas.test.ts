import { describe, expect, it } from "vitest";

import {
  isOverdue,
  isPaidWithoutPaidAt,
  netPaidMovementCents,
  paidInPeriod,
  postedInPeriod,
  sumCents,
  type FinRow,
} from "@/lib/diretor/metrics/financial-formulas";

const from = new Date("2026-08-01T00:00:00.000Z");
const to = new Date("2026-08-31T23:59:59.999Z");

function row(p: Partial<FinRow>): FinRow {
  return {
    kind: "ENTRADA",
    amountCents: 1000,
    entryDate: new Date("2026-08-10T00:00:00.000Z"),
    paidAt: new Date("2026-08-15T00:00:00.000Z"),
    paymentStatus: "PAGO",
    categoryId: "c",
    poloId: "p",
    expenseNature: null,
    deletedAt: null,
    ...p,
  };
}

describe("fórmulas financeiras", () => {
  it("soma em centavos sem perda", () => {
    expect(sumCents([{ amountCents: 199 }, { amountCents: 1 }])).toBe(200);
  });

  it("entryDate ≠ paidAt", () => {
    const r = row({
      entryDate: new Date("2026-07-01T00:00:00.000Z"),
      paidAt: new Date("2026-08-02T00:00:00.000Z"),
      paymentStatus: "PAGO",
    });
    expect(postedInPeriod(r, from, to)).toBe(false);
    expect(paidInPeriod(r, from, to)).toBe(true);
  });

  it("pago sem paidAt não entra em paidInPeriod", () => {
    const r = row({ paymentStatus: "PAGO", paidAt: null });
    expect(isPaidWithoutPaidAt(r)).toBe(true);
    expect(paidInPeriod(r, from, to)).toBe(false);
  });

  it("deletedAt é excluído", () => {
    const r = row({ deletedAt: new Date() });
    expect(postedInPeriod(r, from, to)).toBe(false);
    expect(paidInPeriod(r, from, to)).toBe(false);
  });

  it("vencido PENDENTE", () => {
    expect(
      isOverdue(row({ paymentStatus: "PENDENTE", entryDate: new Date("2026-08-01") }), new Date("2026-08-20")),
    ).toBe(true);
  });

  it("movimentação líquida", () => {
    expect(netPaidMovementCents(5000, 2000)).toBe(3000);
  });
});
