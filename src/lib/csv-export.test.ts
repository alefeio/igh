import { describe, expect, it } from "vitest";

import { csvEscapeCell, neutralizeCsvFormula, rowsToCsvSemicolon, safeReportFilename } from "@/lib/csv-export";

describe("CSV export", () => {
  it("neutraliza fórmula (= + - @)", () => {
    expect(neutralizeCsvFormula("=CMD()")).toBe("'=CMD()");
    expect(neutralizeCsvFormula("+1+1")).toBe("'+1+1");
    expect(neutralizeCsvFormula("-2+3")).toBe("'-2+3");
    expect(neutralizeCsvFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeCsvFormula("ok")).toBe("ok");
  });

  it("aspas, vírgulas/ponto-e-vírgula e quebras de linha", () => {
    expect(csvEscapeCell('a"b')).toBe('"a""b"');
    expect(csvEscapeCell("a;b")).toBe('"a;b"');
    expect(csvEscapeCell("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });

  it("UTF-8 com BOM e acentos", () => {
    const csv = rowsToCsvSemicolon(["título"], [["São Paulo"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("São Paulo");
  });

  it("nome de arquivo seguro", () => {
    expect(safeReportFilename("../x", "csv")).toBe("diretor-x.csv");
    expect(safeReportFilename("academic", "json")).toBe("diretor-academic.json");
    expect(safeReportFilename("executive", "pdf")).toBe("diretor-executive.pdf");
    expect(safeReportFilename("financial", "xlsx")).toBe("diretor-financial.xlsx");
  });
});
