import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

vi.mock("server-only", () => ({}));

import { SOCIAL_PRESENCE_PARTIAL_NOTE } from "@/lib/diretor/metrics/attendance-formulas";
import { buildDirectorPdf } from "@/lib/diretor/reports/pdf";
import { buildDirectorXlsx } from "@/lib/diretor/reports/xlsx";
import { excelNaiveDateFromBrazilIso, formatInstantPtBr, qualityStatusLabel } from "@/lib/diretor/ui-labels";

function isBlankCell(cell: ExcelJS.Cell): boolean {
  const v = cell.value;
  return v == null;
}

describe("exportações — regressão da homologação", () => {
  const generatedAt = "2026-08-24T17:10:00.000Z";

  it(
    "Impacto Social fica Leitura parcial no PDF e no XLSX quando completude < 90%", async () => {
    const quality = [
      { domain: "academic", status: "partial", note: "64,5% das chamadas preenchidas" },
      { domain: "social", status: "partial", note: SOCIAL_PRESENCE_PARTIAL_NOTE },
      { domain: "offer", status: "ok" },
    ];
    const kpis = [
      { label: "Atendidos únicos", value: 880, quality: "partial", currentValue: 880 },
      { label: "Risco crítico por faltas", value: 12, quality: "partial", currentValue: 12 },
    ];
    const pdf = Buffer.from(
      await buildDirectorPdf({
        title: "Executivo",
        generatedAt,
        dataAsOf: generatedAt,
        formulaVersion: "1C.0.0",
        indicators: { kpis },
        quality,
      }),
    );
    const { CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Uint8Array.from(pdf), CanvasFactory });
    try {
      const text = (await parser.getText()).text ?? "";
      expect(text).toContain("Leitura parcial");
      expect(text).toContain("Impacto Social");
      expect(qualityStatusLabel("partial")).toBe("Leitura parcial");
      expect(text).toContain(SOCIAL_PRESENCE_PARTIAL_NOTE);
    } finally {
      await parser.destroy().catch(() => undefined);
    }

    const xlsx = await buildDirectorXlsx({
      title: "Executivo",
      generatedAt,
      dataAsOf: generatedAt,
      formulaVersion: "1C.0.0",
      indicators: { kpis },
      quality,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as never);
    const qual = wb.getWorksheet("Qualidade")!;
    const socialRow = qual
      .getSheetValues()
      .find((row) => row != null && JSON.stringify(row).includes("Impacto Social")) as unknown[] | undefined;
    expect(JSON.stringify(socialRow)).toContain("Leitura parcial");
    expect(JSON.stringify(socialRow)).toContain("Atendidos, novos, recorrentes e concluintes");
  },
    20_000,
  );

  it("células sem conteúdo permanecem vazias após gerar e reabrir o XLSX", async () => {
    const buf = await buildDirectorXlsx({
      title: "Executivo",
      generatedAt,
      dataAsOf: generatedAt,
      formulaVersion: "1C.0.0",
      indicators: {
        kpis: [
          { label: "A", value: 1, metricId: "a", quality: "ok", currentValue: 1 },
          { label: "B", value: 2, metricId: "b", quality: "ok", currentValue: 2 },
          { label: "C", value: 3, metricId: "c", quality: "ok", currentValue: 3 },
        ],
      },
      quality: [
        { domain: "academic", status: "partial", note: "chamadas incompletas" },
        { domain: "social", status: "partial", note: SOCIAL_PRESENCE_PARTIAL_NOTE },
        { domain: "offer", status: "ok" },
        { domain: "financial", status: "ok" },
        { domain: "administrative", status: "ok" },
        { domain: "projects", status: "ok" },
      ],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const ind = wb.getWorksheet("Indicadores")!;
    expect(isBlankCell(ind.getCell("G3"))).toBe(true);
    expect(isBlankCell(ind.getCell("G4"))).toBe(true);
    const qual = wb.getWorksheet("Qualidade")!;
    expect(isBlankCell(qual.getCell("C4"))).toBe(true);
    expect(isBlankCell(qual.getCell("C5"))).toBe(true);
    expect(isBlankCell(qual.getCell("C6"))).toBe(true);
    expect(isBlankCell(qual.getCell("C7"))).toBe(true);
    expect(qual.getCell("C4").value).not.toBe("");
    expect(ind.getCell("G3").value).not.toBe("");
  });

  it("horário do XLSX coincide com o relógio de Brasília do PDF", async () => {
    const naive = excelNaiveDateFromBrazilIso(generatedAt)!;
    expect(naive.getUTCFullYear()).toBe(2026);
    expect(naive.getUTCMonth()).toBe(7);
    expect(naive.getUTCDate()).toBe(24);
    expect(naive.getUTCHours()).toBe(14);
    expect(naive.getUTCMinutes()).toBe(10);
    expect(formatInstantPtBr(generatedAt)).toContain("24/08/2026");
    expect(formatInstantPtBr(generatedAt)).toContain("14:10");

    const buf = await buildDirectorXlsx({
      title: "Executivo",
      generatedAt,
      dataAsOf: generatedAt,
      formulaVersion: "1C.0.0",
      indicators: { kpis: [] },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const b5 = wb.getWorksheet("Resumo")!.getCell("B5").value as Date;
    expect(b5).toBeInstanceOf(Date);
    expect(b5.getUTCHours()).toBe(14);
    expect(b5.getUTCMinutes()).toBe(10);
    expect(b5.getUTCDate()).toBe(24);
  });

  it("PDF traz 74,4% e 0 de 1.000 — 0% completos, com barra 0%", async () => {
    const bytes = await buildDirectorPdf({
      title: "Executivo",
      generatedAt,
      dataAsOf: generatedAt,
      formulaVersion: "1C.0.0",
      indicators: {
        kpis: [
          {
            label: "Ocupação",
            value: 74.4,
            unit: "%",
            percentage: 74.4,
            formattedValue: "74,4%",
            quality: "ok",
          },
          {
            label: "Equipamentos doados vs meta",
            value: 0,
            currentValue: 0,
            targetValue: 1000,
            percentage: 0,
            formattedValue: "0 de 1.000 — 0%",
            quality: "ok",
            unit: "%",
          },
          { label: "Atendidos únicos", value: 880, quality: "partial", currentValue: 880 },
          { label: "Risco crítico por faltas", value: 4, quality: "partial", currentValue: 4 },
        ],
      },
      quality: [{ domain: "social", status: "partial", note: SOCIAL_PRESENCE_PARTIAL_NOTE }],
    });
    const { CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Uint8Array.from(bytes), CanvasFactory });
    try {
      const text = (await parser.getText()).text ?? "";
      expect(text).toContain("74,4%");
      expect(text).toContain("0 de 1.000 — 0%");
      expect(text).toContain("Leitura parcial");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }, 20_000);
});
