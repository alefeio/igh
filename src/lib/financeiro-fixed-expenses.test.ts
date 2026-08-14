import { describe, expect, it } from "vitest";

import {
  addCalendarMonth,
  buildFixedExpensePatterns,
  findMissingFixedExpenses,
  normalizeFixedExpenseDescription,
} from "@/lib/financeiro-fixed-expenses";

describe("normalizeFixedExpenseDescription", () => {
  it("remove competência e número de documento", () => {
    expect(normalizeFixedExpenseDescription("Conta de água · Doc 152837009 — 08/2026")).toBe(
      "conta de agua",
    );
  });
});

describe("fixed expense patterns", () => {
  const rows = [
    {
      description: "Aluguel sede — julho",
      amountCents: 500_000,
      entryDate: "2026-07-05",
      categoryId: "cat-aluguel",
      categoryName: "Aluguel",
    },
    {
      description: "Aluguel sede — agosto",
      amountCents: 520_000,
      entryDate: "2026-08-05",
      categoryId: "cat-aluguel",
      categoryName: "Aluguel",
    },
    {
      description: "Internet fibra",
      amountCents: 12_000,
      entryDate: "2026-07-10",
      categoryId: "cat-net",
      categoryName: "Internet",
    },
  ];

  it("agrupa por categoria + descrição normalizada e alerta o que falta no mês", () => {
    const patterns = buildFixedExpensePatterns(rows);
    expect(patterns).toHaveLength(2);
    const august = findMissingFixedExpenses(
      patterns,
      [{ description: "Aluguel sede — agosto", categoryId: "cat-aluguel" }],
      "2026-08",
    );
    expect(august).toHaveLength(1);
    expect(august[0].description).toMatch(/internet/i);
    expect(august[0].missingForMonth).toBe("2026-08");
  });

  it("avança o mês calendário", () => {
    expect(addCalendarMonth("2026-12", 1)).toBe("2027-01");
  });
});
