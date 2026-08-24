import { describe, expect, it } from "vitest";

import {
  isOpenPayableOrReceivable,
  isPaidWithoutPaidAt,
  netPaidMovementCents,
  openAgeBucket,
  openAgeDays,
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

describe("fórmulas financeiras 1C", () => {
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
  });

  it("lançamento em aberto não depende de paidAt", () => {
    const r = row({ paymentStatus: "EM_ABERTO", paidAt: null });
    expect(isOpenPayableOrReceivable(r.paymentStatus)).toBe(true);
  });

  it("idade em aberto = dataAsOf − entryDate (não é vencimento)", () => {
    const asOf = new Date("2026-08-20T00:00:00.000Z");
    expect(openAgeDays(new Date("2026-08-10T00:00:00.000Z"), asOf)).toBe(10);
  });

  it("buckets de idade exclusivos sem a_vencer", () => {
    const asOf = new Date("2026-08-31T00:00:00.000Z");
    expect(openAgeBucket(new Date("2026-08-20T00:00:00.000Z"), asOf)).toBe("d0_30");
    expect(openAgeBucket(new Date("2026-07-20T00:00:00.000Z"), asOf)).toBe("d31_60");
    expect(openAgeBucket(new Date("2026-06-20T00:00:00.000Z"), asOf)).toBe("d61_90");
    expect(openAgeBucket(new Date("2026-05-01T00:00:00.000Z"), asOf)).toBe("d91_plus");
    expect(openAgeBucket(new Date("2026-09-10T00:00:00.000Z"), asOf)).toBe("d0_30");
  });

  it("módulo não exporta isOverdue nem a_vencer", async () => {
    const mod = await import("@/lib/diretor/metrics/financial-formulas");
    expect("isOverdue" in mod).toBe(false);
    expect("agingBucket" in mod).toBe(false);
  });

  it("movimentação líquida", () => {
    expect(netPaidMovementCents(5000, 2000)).toBe(3000);
  });
});
