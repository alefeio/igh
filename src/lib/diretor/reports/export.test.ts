import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

vi.mock("server-only", () => ({}));

import { alertsFromExecutiveFacts } from "@/lib/diretor/alerts/engine";
import { buildDirectorPdf } from "@/lib/diretor/reports/pdf";
import { buildDirectorXlsx } from "@/lib/diretor/reports/xlsx";

describe("engine sem loaders", () => {
  it("gera alerta de idade em aberto sem consultar banco", () => {
    const alerts = alertsFromExecutiveFacts({
      financial: {
        netPaidCents: 0,
        apCents: 1,
        arCents: 0,
        openAge91PlusCents: 5000,
        periodLabel: "2026-08",
        quality: [{ domain: "financial", status: "ok" }],
        qualityNotes: [],
      },
    });
    expect(alerts.some((a) => a.id === "fin-open-age-90")).toBe(true);
    expect(JSON.stringify(alerts).toLowerCase()).not.toContain("vencid");
    expect(JSON.stringify(alerts).toLowerCase()).not.toContain("inadimpl");
  });
});

describe("PDF e XLSX", () => {
  const report = {
    title: "Executivo",
    institution: "IGH",
    period: { scope: "current" },
    generatedAt: "2026-08-23T12:00:00.000Z",
    dataAsOf: "2026-08-23T12:00:00.000Z",
    formulaVersion: "1C.0.0",
    indicators: { kpis: [{ label: "Atendidos", value: 10, formula: "distinct", metricId: "soc.served_unique", quality: "ok" }] },
    alerts: [],
    quality: [],
    caveats: [],
    disclaimer: "sem PII",
  };

  it("PDF começa com %PDF", async () => {
    const bytes = await buildDirectorPdf(report);
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("XLSX é zip, data formatada e sem 58 fantasma nas definições", async () => {
    const buf = await buildDirectorXlsx({
      ...report,
      generatedAt: "2026-08-23T12:00:00.000Z",
      formulaVersion: "1C.0.0",
      indicators: {
        kpis: [
          {
            label: "Equipamentos",
            value: "0 de 1.000 — 0%",
            metricId: "soc.computers_donated",
            formula: "doações",
            quality: "ok",
            currentValue: 0,
            targetValue: 1000,
            percentage: 0,
            formattedValue: "0 de 1.000 — 0%",
          },
        ],
      },
    });
    expect(buf[0]).toBe(0x50);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const def = wb.getWorksheet("Definições");
    const blob = JSON.stringify(def?.getSheetValues());
    expect(blob).not.toMatch(/(^|[^0-9])58([^0-9]|$)/);
    expect(def?.getCell("A2").value).not.toBe(58);
    const last = def?.lastRow?.number ?? 0;
    expect(String(def?.getCell(last, 1).value)).toBe("metadata.formula_version");
    const resumo = wb.getWorksheet("Resumo");
    expect(resumo?.getCell("B5").value).toBeInstanceOf(Date);
  });
});
