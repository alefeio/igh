import { describe, expect, it } from "vitest";

import { extractDonationTermFromText, isDonationTermSuggestionUseful } from "@/lib/donation-term-parse";

const SAMPLE = `
TERMO DE DOAÇÃO DE EQUIPAMENTOS
DOADORA:
Nome: Instituto Gente Humana
CNPJ: 12.345.678/0001-90
Endereço: Rua A, 100
Cidade: Belém
Estado: PA
CEP: 66000-000
Responsável Legal: Maria Silva
Cargo: Diretora
CPF: 123.456.789-00
TEL: (91) 3000-0000
Email: contato@igh.org

DONATÁRIA
Instituição: Escola Municipal Sol Nascente
CNPJ: 98.765.432/0001-10
Endereço: Av. Central, 50
Cidade/Município: Ananindeua
Estado: PA
CEP: 67000-000
Zona: (X) Urbana  ( ) Rural
Responsável: João Souza
Telefone: (91) 98888-7777
E-mail: escola@example.com

OBJETO
Computador              10
Monitor                 10

Belém, 26 de agosto de 2026
`;

describe("extractDonationTermFromText", () => {
  it("extrai doadora, donatária e data do modelo IGH", () => {
    const s = extractDonationTermFromText(SAMPLE);
    expect(isDonationTermSuggestionUseful(s)).toBe(true);
    expect(s.donorName).toMatch(/Instituto Gente Humana/i);
    expect(s.donorDocument?.replace(/\D/g, "")).toBe("12345678000190");
    expect(s.donatariaName).toMatch(/Sol Nascente/i);
    expect(s.donatariaDocument?.replace(/\D/g, "")).toBe("98765432000110");
    expect(s.donatariaCity).toMatch(/Ananindeua/i);
    expect(s.donatariaZone).toBe("URBANA");
    expect(s.donatedAt).toBe("2026-08-26");
    expect(s.placeDateText).toMatch(/Belém/i);
    expect(s.kitsCount).toBe(10);
  });
});
