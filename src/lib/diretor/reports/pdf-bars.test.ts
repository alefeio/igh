import { describe, expect, it } from "vitest";

import { formatPtPercent, pdfBarWidth, resolvePdfBar } from "@/lib/diretor/reports/pdf-bars";

describe("barras do PDF — dados tipados", () => {
  it("0% produz largura zero e não parseia string 0 de 1.000", () => {
    const bar = resolvePdfBar(
      {
        label: "Equipamentos",
        currentValue: 0,
        targetValue: 1000,
        percentage: 0,
        formattedValue: "0 de 1.000 — 0%",
        unit: "%",
      },
      "percent",
    );
    expect(bar.plot).toBe(0);
    expect(pdfBarWidth(bar.plot, 100, 280)).toBe(0);
    expect(bar.display).toBe("0 de 1.000 — 0%");
  });

  it("74,4% formata em pt-BR e cabe no eixo 0–100", () => {
    const bar = resolvePdfBar({ label: "Ocupação", percentage: 74.4, unit: "%" }, "percent");
    expect(bar.plot).toBe(74.4);
    expect(formatPtPercent(74.4)).toBe("74,4%");
    expect(pdfBarWidth(bar.plot, 100, 280)).toBeCloseTo(74.4 * 2.8, 5);
  });

  it("100% preenche a área do gráfico sem ultrapassar", () => {
    const bar = resolvePdfBar({ label: "Completude", percentage: 100, unit: "%" }, "percent");
    expect(pdfBarWidth(bar.plot, 100, 280)).toBe(280);
  });

  it("indisponível não produz barra", () => {
    const bar = resolvePdfBar({ label: "X", quality: "unavailable" }, "percent");
    expect(bar.plot).toBeNull();
    expect(pdfBarWidth(bar.plot, 100, 280)).toBeNull();
  });

  it("valor inválido não produz barra", () => {
    const bar = resolvePdfBar({ label: "X", percentage: Number.NaN }, "percent");
    expect(bar.plot).toBeNull();
    expect(pdfBarWidth(Number.POSITIVE_INFINITY, 100, 280)).toBeNull();
  });
});
