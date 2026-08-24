import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

vi.mock("server-only", () => ({}));

import {
  isExecutiveAttendanceReliable,
  reconcileConfirmedNonStart,
} from "@/lib/diretor/metrics/attendance-formulas";
import { OPEN_AGE_CHART_LABEL } from "@/lib/diretor/metrics/financial-formulas";
import { centsToReais } from "@/lib/diretor/ui-labels";
import { buildDirectorPdf } from "@/lib/diretor/reports/pdf";
import { buildDirectorXlsx } from "@/lib/diretor/reports/xlsx";

function page(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("homologação visual 1C — contratos", () => {
  it("layout compartilhado não duplica a navegação global no topo", () => {
    const layout = page("src/app/(protected)/diretor/layout.tsx");
    expect(layout).not.toMatch(/DirectorSubnav|Visão Geral[\s\S]*Prioridades[\s\S]*Acadêmico/);
    expect(layout).not.toMatch(/Guia do Diretor/);
  });

  it("menu lateral do Diretor tem uma única home e oculta Página Inicial / Como usar", () => {
    const sidebar = page("src/components/layout/Sidebar.tsx");
    expect(sidebar).toMatch(/href: "\/diretor"/);
    expect(sidebar).toMatch(/if \(i\.href === "\/dashboard" \|\| i\.href === "\/onboarding"\) return false/);
  });

  it("páginas não expõem jargão técnico pedido na homologação", () => {
    const files = [
      "src/app/(protected)/diretor/page.tsx",
      "src/app/(protected)/diretor/academico/page.tsx",
      "src/app/(protected)/diretor/financeiro/page.tsx",
      "src/app/(protected)/diretor/relatorios/page.tsx",
      "src/app/(protected)/diretor/impacto-social/page.tsx",
    ];
    const blob = files.map(page).join("\n");
    expect(blob).not.toMatch(/Dashboard legado/);
    expect(blob).not.toMatch(/sem snapshot/);
    expect(blob).not.toMatch(/pdf-lib|exceljs/);
    expect(blob).not.toMatch(/· dataAsOf/);
    expect(blob).not.toMatch(/COUNT DISTINCT/);
    expect(blob).not.toMatch(/\bd0_30\b/);
    expect(blob).not.toMatch(/Falha parcial: academic/);
  });

  it("gráficos financeiros usam reais e rótulos humanos", () => {
    const fin = page("src/app/(protected)/diretor/financeiro/page.tsx");
    expect(fin).toContain("centsToReais");
    expect(fin).toContain("formatAxisReais");
    expect(fin).toContain("useBars");
    expect(fin).toContain("min-w-[520px]");
    expect(OPEN_AGE_CHART_LABEL.d0_30).toBe("Até 30 dias");
    expect(centsToReais(550000)).toBe(5500);
  });

  it("atendidos canônicos usam a mesma função nos três loaders", () => {
    const ov = page("src/lib/diretor/metrics/overview.ts");
    const acad = page("src/lib/diretor/facts/academic.ts");
    const acadFull = page("src/lib/diretor/metrics/academic.ts");
    const social = page("src/lib/diretor/metrics/social.ts");
    expect(ov).toContain('metricCard("ben.served_unique", acad.servedUnique');
    expect(acad).toContain("countServedUniqueStudents");
    expect(acadFull).toContain("countServedUniqueStudents");
    expect(social).toContain("countServedUniqueStudents");
    expect(social).toContain('metricCard("ben.served_unique"');
  });

  it("não início reconcilia confirmados − iniciaram", () => {
    const r = reconcileConfirmedNonStart(1739, 930);
    expect(r.notStarted).toBe(809);
    expect(r.rate).toBe(Math.round((809 / 1739) * 1000) / 10);
  });

  it("frequência abaixo do limiar não é confiável para uso executivo", () => {
    expect(isExecutiveAttendanceReliable(64.6)).toBe(false);
    expect(isExecutiveAttendanceReliable(90)).toBe(true);
    const acad = page("src/app/(protected)/diretor/academico/page.tsx");
    expect(acad).toContain("Frequência provisória");
    expect(acad).toContain("Situação da jornada no recorte");
    expect(acad).not.toMatch(/title="Funil/);
  });

  it(
    "PDF não embute JSON bruto nem gráfico de unidades misturadas",
    async () => {
      const bytes = await buildDirectorPdf({
        title: "Executivo",
        period: { scope: "current", weird: true },
        periodLabel: "Ciclo atual · Competência executiva: agosto de 2026",
        generatedAt: "2026-08-24T12:00:00.000Z",
        dataAsOf: "2026-08-24T12:00:00.000Z",
        formulaVersion: "1C.0.0",
        indicators: {
          kpis: [
            { label: "Atendidos", value: 880, unit: "pessoas" },
            { label: "Ocupação", value: 44, unit: "%" },
          ],
        },
        quality: [{ domain: "academic", status: "partial", note: "Chamada incompleta" }],
        disclaimer: "não é saldo bancário",
      });
      const buf = Buffer.from(bytes);
      expect(buf.subarray(0, 4).toString()).toBe("%PDF");
      const raw = buf.toString("latin1");
      expect(raw).not.toContain('{"scope"');
      expect(raw.toLowerCase()).not.toContain("magnitude relativa");
      const src = page("src/lib/diretor/reports/pdf.ts");
      expect(src).toContain("periodLabel");
      expect(src).toContain("formatFiltersHuman");
      expect(src).not.toContain("JSON.stringify");
      expect(src).toContain("Pessoas e volumes");
      expect(src).toContain("Percentuais (eixo de 0 a 100)");
    },
    20_000,
  );

  it("XLSX tipa moeda e percentual e não usa JSON bruto", async () => {
    const buf = await buildDirectorXlsx({
      title: "Executivo",
      periodLabel: "Ciclo atual",
      generatedAt: "2026-08-24T12:00:00.000Z",
      dataAsOf: "2026-08-24T12:00:00.000Z",
      formulaVersion: "1C.0.0",
      indicators: {
        kpis: [
          { label: "Líquido", value: -5990205, metricId: "fin.net.paid", quality: "ok" },
          { label: "Ocupação", value: 44, unit: "%", quality: "ok" },
          { label: "Atendidos", value: 880, quality: "ok" },
        ],
      },
      alerts: [{ title: "A", fact: "B", domain: "financial", severity: "attention" }],
      quality: [{ domain: "academic", status: "partial", note: "incompleto" }],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Resumo", "Indicadores", "Alertas", "Qualidade", "Definições"]);
    const ind = wb.getWorksheet("Indicadores")!;
    expect(ind.getRow(2).getCell(2).value).toBe(-59902.05);
    expect(String(ind.getRow(2).getCell(2).numFmt)).toContain("R$");
    expect(ind.getRow(3).getCell(2).value).toBeCloseTo(0.44);
    expect(ind.getRow(4).getCell(2).value).toBe(880);
    const blob = JSON.stringify(wb.worksheets.map((s) => s.getSheetValues()));
    expect(blob).not.toContain('"scope":');
    expect(blob).not.toMatch(/\{"domain"/);
  });
});
