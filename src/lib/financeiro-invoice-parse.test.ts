import { describe, expect, it } from "vitest";

import { extractFieldsFromText } from "@/lib/financeiro-invoice-parse";

describe("extractFieldsFromText", () => {
  it("extrai valor, data e número de NF de texto típico", () => {
    const text = `
      RAZAO SOCIAL: Padaria do Centro LTDA
      NF-e Nº: 123456
      DATA DE EMISSAO: 10/08/2026
      VALOR TOTAL: R$ 1.250,90
    `;
    const s = extractFieldsFromText(text);
    expect(s.amount).toBe("1.250,90");
    expect(s.entryDate).toBe("2026-08-10");
    expect(s.invoiceNumber).toBe("123456");
    expect(s.supplier).toMatch(/Padaria/i);
  });
});
