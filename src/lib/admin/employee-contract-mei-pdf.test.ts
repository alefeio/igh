import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));

import {
  isMeiServiceContractTemplate,
  renderMeiServiceContractPdfBytes,
} from "@/lib/admin/employee-contract-mei-pdf";
import { formatReaisPorExtenso } from "@/lib/admin/money-pt-extenso";

describe("contrato MEI IGH", () => {
  it("reconhece o modelo pelo título", () => {
    expect(isMeiServiceContractTemplate("Contrato de prestação de serviços (MEI)")).toBe(true);
    expect(isMeiServiceContractTemplate("Contrato CLT")).toBe(false);
  });

  it("formata valor por extenso", () => {
    expect(formatReaisPorExtenso(375000)).toBe("três mil setecentos e cinquenta reais");
  });

  it(
    "gera PDF de duas páginas com logo e rodapé",
    async () => {
      const bytes = await renderMeiServiceContractPdfBytes({
        "instituto.nome": "Instituto Gustavo Hessel",
        "instituto.cnpj": "08.633.366/0001-00",
        "instituto.logradouro": "TV. Padre eutiquio, nº 3775 - Condor",
        "instituto.cidade": "Belém",
        "instituto.estado": "PA",
        "instituto.cep": "66065-165",
        "instituto.responsavel": "Guilherme de Oliveira Hessel",
        "instituto.responsavel_estado_civil": "casado",
        "instituto.cargo": "Administrador Financeiro",
        "instituto.responsavel_rg": "54.040.895-5",
        "instituto.cpf": "431.501.768-08",
        "instituto.responsavel_endereco": "São Paulo, SP",
        "funcionario.nome": "Maurício dos Santos Vaz Junior",
        "funcionario.nacionalidade": "brasileiro(a)",
        "funcionario.estado_civil": "solteiro",
        "funcionario.rg": "1234567",
        "funcionario.cpf": "123.456.789-00",
        "funcionario.cidade_estado": "Belém, PA",
        "funcionario.cargo": "Educador Social",
        "funcionario.email": "teste@example.com",
        "contrato.convenio": "971744/2025",
        "contrato.valor": "R$ 3.750,00",
        "contrato.valor_extenso": "três mil setecentos e cinquenta reais",
        "contrato.duracao_meses": "03 meses",
        "contrato.inicio_extenso": "04 de agosto de 2026",
        "contrato.fim_extenso": "04 de outubro de 2026",
        "contrato.data": "04 de agosto de 2026",
      });
      expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(2);
      if (process.env.WRITE_PDF === "1") {
        const out = path.join(process.cwd(), "tmp", "contrato-mei-sample.pdf");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, bytes);
      }
    },
    30_000,
  );
});
