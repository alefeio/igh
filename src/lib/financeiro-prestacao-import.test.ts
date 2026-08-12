import { describe, expect, it } from "vitest";

import {
  excelSerialToIsoDate,
  mapPaymentMethodFromSpreadsheet,
  parsePrestacaoSheetMatrix,
  parseSpreadsheetAmountToCents,
  parseSpreadsheetDate,
} from "@/lib/financeiro-prestacao-import";

describe("financeiro-prestacao-import", () => {
  it("converte serial Excel e valores BR", () => {
    expect(excelSerialToIsoDate(46240)).toBe("2026-08-06");
    expect(parseSpreadsheetDate(46241)).toBe("2026-08-07");
    expect(parseSpreadsheetDate("02/08/2026")).toBe("2026-08-02");
    expect(parseSpreadsheetAmountToCents(14.5)).toBe(1450);
    expect(parseSpreadsheetAmountToCents("1.234,56")).toBe(123456);
    expect(mapPaymentMethodFromSpreadsheet("CARTÃO DE CRÉDITO")).toBe("CARTAO");
    expect(mapPaymentMethodFromSpreadsheet("PIX")).toBe("PIX");
    expect(mapPaymentMethodFromSpreadsheet("CRÉDITO")).toBe("CARTAO");
  });

  it("extrai saídas do modelo de prestação de contas", () => {
    const matrix = [
      ["", "", "CONTROLE DE CONTAS"],
      ["", "", "MÊS DE AGOSTO DE 2026"],
      ["", "", "Adm. Auriane Santos"],
      ["DESCRIÇÃO", "DATA", "Valores", "Forma de Pagamento", "LOCAL", "SAIDAS PARA O GALPÃO 14", "OBSERVAÇÃO", "Total"],
      [
        "MATERIAL DE CONSTRUÇÃO ( PARAFUSOS )",
        46240,
        14.5,
        "CARTÃO DE CRÉDITO",
        "FERPEÇAS LTDA",
        "3 GARRAFÕES DE ÁGUA / 14",
        "",
        "",
      ],
      [
        "SERVIÇO DE ELÉTRICA",
        46241,
        190,
        "PIX",
        "ANDREI ELÉTRICA E REFRIGERAÇÃO",
        "",
        "FEITO PELO SEU JULIO",
        "",
      ],
      ["BATERIA CRC", 46244, "", "", "BRAZZ BRAZZ MATRIZ", "", "", ""],
    ];

    const parsed = parsePrestacaoSheetMatrix("Agosto 2026", matrix);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      description: "MATERIAL DE CONSTRUÇÃO ( PARAFUSOS )",
      entryDate: "2026-08-06",
      amountCents: 1450,
      paymentMethod: "CARTAO",
      supplier: "FERPEÇAS LTDA",
      responsibleName: "3 GARRAFÕES DE ÁGUA / 14",
    });
    expect(parsed.rows[1]).toMatchObject({
      description: "SERVIÇO DE ELÉTRICA",
      entryDate: "2026-08-07",
      amountCents: 19000,
      paymentMethod: "PIX",
      supplier: "ANDREI ELÉTRICA E REFRIGERAÇÃO",
      responsibleName: "Adm. Auriane Santos",
    });
    expect(parsed.rows[1].notes).toContain("FEITO PELO SEU JULIO");
    expect(parsed.skipped.some((s) => s.reason.includes("Valor"))).toBe(true);
  });
});
