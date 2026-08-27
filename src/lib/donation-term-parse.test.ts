import { describe, expect, it } from "vitest";

import {
  donatariaNameHintFromFileName,
  extractDonationTermFromText,
  isDonationTermSuggestionUseful,
  suggestDonationTermTemplateId,
} from "@/lib/donation-term-parse";

const OCR_SAMPLE = `DOADORA: ã À Í
Nome: INSTITUTO GUSTAVO HESSEL | i
CNPJ: 08,633,366/0001-00
Endereço: Travessa padre eutiquio, 3775 - Condor Í
Email: guilherme(&igh.org.br | HW
DONATÁRIA H
Instituição: ASSOCIAÇÃO RATATA i
CNPJ: 36.215.585/00001-04 Í
Endereço: Agua Boa nº5 i i
Responsável: Alex Martins Chaves |U EA REA :
Telefone: (91) 98147-9405 |
OBJETO
O objeto do presente TERMO é a DOAÇÃO, sem nenhum encargo
Equipamentos Qtd
Monitor 10
Teclado 10
Mouse 10
Cabo de Força 20
Cabo de Video 10
OBS: Os termos serão contabilizados`;

describe("donation-term-parse OCR noise", () => {
  it("extrai doadora/donatária de texto OCR ruidoso", () => {
    const s = extractDonationTermFromText(OCR_SAMPLE);
    expect(isDonationTermSuggestionUseful(s)).toBe(true);
    expect(s.donorName).toBe("INSTITUTO GUSTAVO HESSEL");
    expect(s.donorDocument?.replace(/\D/g, "")).toBe("08633366000100");
    expect(s.donatariaName).toMatch(/ASSOCIAÇÃO RATATA/i);
    expect(s.donatariaDocument?.replace(/\D/g, "")).toBe("36215585000104");
    expect(s.donatariaContactName).toBe("Alex Martins Chaves");
    expect(s.donatariaPhone).toMatch(/98147/);
    expect(s.donorEmail).toMatch(/guilherme@igh\.org\.br/i);
  });

  it("infere kits pela tabela OBJETO e modelo IGH", () => {
    const s = extractDonationTermFromText(OCR_SAMPLE);
    expect(s.kitsCount).toBe(10);
    expect(s.templateKind).toBe("IGH");
  });
});

describe("donatariaNameHintFromFileName", () => {
  it("usa o nome do arquivo como sugestão", () => {
    expect(donatariaNameHintFromFileName("ASSOCIAÇÃO RATATA.pdf")).toBe("ASSOCIAÇÃO RATATA");
  });
});

describe("suggestDonationTermTemplateId", () => {
  it("escolhe o modelo (IGH) quando aplicável", () => {
    const id = suggestDonationTermTemplateId("IGH", [
      { id: "1", title: "Termo de doação de equipamentos" },
      { id: "2", title: "Termo de doação de equipamentos (IGH)" },
    ]);
    expect(id).toBe("2");
  });
});
