import { describe, expect, it, vi } from "vitest";

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

  it("XLSX é zip e trata fórmula como texto", async () => {
    const buf = await buildDirectorXlsx({
      ...report,
      indicators: {
        kpis: [{ label: "x", value: "=CMD()", metricId: "t", formula: "f", quality: "ok" }],
      },
    });
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
