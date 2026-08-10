import { describe, expect, it } from "vitest";

import { extractFieldsFromText, normalizeMoneyCapture } from "@/lib/financeiro-invoice-parse";

describe("normalizeMoneyCapture", () => {
  it("aceita formato BR e US", () => {
    expect(normalizeMoneyCapture("26,97")).toBe("26,97");
    expect(normalizeMoneyCapture("26.97")).toBe("26,97");
    expect(normalizeMoneyCapture("1.250,90")).toBe("1.250,90");
  });
});

describe("extractFieldsFromText", () => {
  it("extrai NF típica", () => {
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

  it("extrai conta de água (Águas do Pará)", () => {
    const text = `
MORADOR:
ENDEREÇO:
JULIO CESAR HESSEL - DOC. PRINC.: 21409387801
TV QUATORZE DE ABRIL 2341 CA 0000 - CREMACAO - BELEM - PA - Cep:66065610
AGUAS DO PARA A SPE S.A.
TELEFONE: 0800 091 0091
CNPJ/MF: 61.067.901/0001-95
Mátricula:
Fatura n°:
Referência:
Valor:
Data de Vencimento:
102488086-6
152837009
07/2026
10/08/2026
R$ 26.97
Data de Emissão:
05/08/2026
TOTAL A PAGAR 26,97
HISTÓRICO DE CONSUMO 91,10
    `;
    const s = extractFieldsFromText(text);
    expect(s.amount).toBe("26,97");
    expect(s.entryDate).toBe("2026-08-10");
    expect(s.invoiceNumber).toBe("152837009");
    expect(s.supplier).toMatch(/AGUAS DO PARA/i);
  });
});
