import { describe, expect, it } from "vitest";

import {
  extractFieldsFromText,
  matchCategoryName,
  normalizeMoneyCapture,
} from "@/lib/financeiro-invoice-parse";

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
    expect(s.categoryName).toBe("Água");
  });

  it("extrai vencimento de NFAg (Águas do Pará — layout VENCIMENTO)", () => {
    const text = `
DOCUMENTO AUXILIAR DE NOTA FISCAL DE ÁGUA E SANEAMENTO ELETRÔNICA
REFERÊNCIA EMISSÃO TOTAL A PAGAR
Nº DE FATURA IDENTIFICADOR VENCIMENTO
R$ 219,76
15/09/2026
08/2026 10/08/2026
06/07/2026
REFERÊNCIA VENCIMENTO TOTAL (R$)
15/09/2026 R$ 219,76	08/2026
SUJEITO A CORTE A PARTIR DE 15/10/2026
DATA: 05/08/2026, ÀS 17:14:47
AGUAS DO PARA A SPE S.A.
NÚMERO DA NOTA FISCAL: 27762
TOTAL A PAGAR
`;
    const s = extractFieldsFromText(text);
    expect(s.entryDate).toBe("2026-09-15");
    expect(s.amount).toBe("219,76");
    expect(s.invoiceNumber).toBe("27762");
    expect(s.categoryName).toBe("Água");
  });

  it("reconhece conta de luz e casa categoria existente", () => {
    const text = "EQUATORIAL PARÁ — ENERGIA ELÉTRICA\nTOTAL A PAGAR R$ 312,40\nVENCIMENTO 20/08/2026";
    const s = extractFieldsFromText(text);
    expect(s.categoryName).toBe("Energia");
    const matched = matchCategoryName(
      [
        { id: "1", name: "Conta de luz" },
        { id: "2", name: "Água" },
      ],
      s.categoryName!,
    );
    expect(matched?.id).toBe("1");
  });

  it("cai em Despesas operacionais quando não há categoria específica", () => {
    const matched = matchCategoryName(
      [
        { id: "op", name: "Despesas operacionais" },
        { id: "mat", name: "Material / almoxarifado" },
        { id: "mei", name: "Nota MEI / colaborador" },
        { id: "out", name: "Outras saídas" },
        { id: "srv", name: "Serviços" },
      ],
      "Água",
    );
    expect(matched?.id).toBe("op");
  });

  it("extrai DANFS-e (NFS-e) sem confundir rótulo Telefone nem EMITENTE DA NFS-e", () => {
    const text = `
DANFSe v1.0
Documento Auxiliar da NFS-e
Prefeitura Municipal de Belém
Chave de Acesso da NFS-e
15014022264798644000150000000000000826081516444402
Número da NFS-e
8
Competência da NFS-e
01/08/2026
Data e Hora da emissão da NFS-e
03/08/2026 08:57:45
EMITENTE DA NFS-e
Prestador do Serviço
CNPJ / CPF / NIF
64.798.644/0001-50
Telefone
-
Nome / Nome Empresarial
64.798.644 ALEXANDRE THIAGO FEIO PENHA
TOMADOR DO SERVIÇO CNPJ / CPF / NIF
08.633.366/0001-00
Nome / Nome Empresarial
INSTITUTO GUSTAVO HESSEL
Descrição do Serviço
Serviço prestado de educador social no período de 01 de Julho de 2026 à 31 de Julho de 2026, tendo como dados bancários conta pessoal juridica.
Nubank - 0260 / Agência: 0001 / Conta: 117011346-5 / chavepix: 64.798.644/0001-50.
TRIBUTAÇÃO MUNICIPAL
Valor do Serviço
R$ 3.750,00
VALOR TOTAL DA NFS-E
Valor Líquido da NFS-e
R$ 3.750,00
`;
    const s = extractFieldsFromText(text);
    expect(s.amount).toBe("3.750,00");
    expect(s.invoiceNumber).toBe("8");
    expect(s.supplier).toMatch(/ALEXANDRE THIAGO FEIO PENHA/i);
    expect(s.supplier).not.toMatch(/DA NFS/i);
    expect(s.description).toMatch(/educador social/i);
    expect(s.description).not.toMatch(/Conta de telefone/i);
    expect(s.categoryName).toBeUndefined();
    // Competência do serviço (julho), não só a data de emissão/competência formal (agosto)
    expect(s.entryDate?.slice(0, 7)).toBe("2026-07");
  });
});
