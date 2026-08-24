import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  classifyNewVsRecurrent,
  computersProgress,
  lgpdCount,
  multiCourseStudentIds,
  peopleGoalComparable,
} from "@/lib/diretor/metrics/social-formulas";
import { contractHorizon, inventoryStockBand, isBelowMinStock, isZeroStock } from "@/lib/diretor/metrics/admin-formulas";
import { collectDirectorAlerts, topPriorityAlerts } from "@/lib/diretor/alerts/engine";

describe("social / admin / lgpd", () => {
  it("deduplica e classifica novos vs recorrentes", () => {
    const r = classifyNewVsRecurrent({
      servedIds: ["a", "a", "b", "c"],
      previouslyServedIds: ["b"],
    });
    expect(r.newIds.sort()).toEqual(["a", "c"]);
    expect(r.recurrentIds).toEqual(["b"]);
  });

  it("duas matrículas no período não tornam a pessoa recorrente", () => {
    const r = classifyNewVsRecurrent({
      servedIds: ["pessoa-1"],
      previouslyServedIds: [],
    });
    expect(r.newIds).toEqual(["pessoa-1"]);
    expect(r.recurrentIds).toEqual([]);
    expect(multiCourseStudentIds(new Map([["pessoa-1", new Set(["turma-a", "turma-b"])]]))).toEqual([
      "pessoa-1",
    ]);
  });

  it("meta de pessoas incompatível", () => {
    expect(peopleGoalComparable()).toBe(false);
  });

  it("LGPD suprime grupos <5", () => {
    expect(lgpdCount(3)).toBe("<5");
    expect(lgpdCount(5)).toBe(5);
  });

  it("progresso de computadores", () => {
    expect(computersProgress(25, 50)).toBe(50);
    expect(computersProgress(1, 0)).toBeNull();
  });

  it("contratos 30/60/90 exclusivos", () => {
    const asOf = new Date("2026-08-01T00:00:00.000Z");
    expect(contractHorizon(new Date("2026-07-01T00:00:00.000Z"), asOf)).toBe("expired");
    expect(contractHorizon(new Date("2026-08-20T00:00:00.000Z"), asOf)).toBe("d30");
    expect(contractHorizon(new Date("2026-09-15T00:00:00.000Z"), asOf)).toBe("d60");
    expect(contractHorizon(new Date("2026-10-20T00:00:00.000Z"), asOf)).toBe("d90");
    expect(contractHorizon(new Date("2026-08-20T00:00:00.000Z"), asOf)).not.toBe("d60");
  });

  it("estoque zerado / no mínimo / acima são exclusivos", () => {
    expect(isZeroStock(0)).toBe(true);
    expect(isBelowMinStock(2, 5)).toBe(true);
    expect(isBelowMinStock(0, 5)).toBe(false);
    expect(inventoryStockBand(0, 5)).toBe("zero");
    expect(inventoryStockBand(3, 5)).toBe("at_or_below_min");
    expect(inventoryStockBand(9, 5)).toBe("above_min");
  });
});

describe("engine de alertas", () => {
  it("prioriza críticos sem inventar responsável", () => {
    const list = collectDirectorAlerts([
      [
        {
          id: "i",
          domain: "offer",
          severity: "info",
          title: "i",
          fact: "f",
          href: "/",
          source: "s",
        },
        {
          id: "c",
          domain: "academic",
          severity: "critical",
          title: "c",
          fact: "f",
          href: "/",
          source: "s",
        },
      ],
    ]);
    expect(topPriorityAlerts(list, 1)[0].id).toBe("c");
    expect(list[0].operationalOwner ?? "não acompanhado pelo sistema").toBe("não acompanhado pelo sistema");
  });
});

describe("independência dos loaders", () => {
  const root = path.join(process.cwd(), "src/lib/diretor/metrics");
  it("academic não consulta waitlist/seat offer", () => {
    const t = readFileSync(path.join(root, "academic.ts"), "utf8");
    expect(t).not.toMatch(/waitlistSeatOffer/i);
    expect(t).not.toMatch(/enrollmentWaitlist/i);
  });
  it("offer não carrega frequência/conclusão detalhada", () => {
    const t = readFileSync(path.join(root, "offer.ts"), "utf8");
    expect(t).not.toMatch(/sessionAttendance/i);
    expect(t).not.toMatch(/computeOpportunityRates/);
    expect(t).not.toMatch(/hasStarted/);
  });
  it("overview usa summaries e não recarrega social completo", () => {
    const t = readFileSync(path.join(process.cwd(), "src/lib/diretor/metrics/overview.ts"), "utf8");
    expect(t).toMatch(/loadAcademicExecutiveFacts/);
    expect(t).toMatch(/alertsFromExecutiveFacts/);
    expect(t).not.toMatch(/loadAcademic\(/);
    expect(t).not.toMatch(/loadOffer\(/);
    expect(t).not.toMatch(/loadSocialImpact/);
  });
  it("financial não importa academic", () => {
    const t = readFileSync(path.join(root, "financial.ts"), "utf8");
    expect(t).not.toMatch(/metrics\/academic/);
  });
  it("projects não consulta PaymentAgreement e não zera portfólio", () => {
    const t = readFileSync(path.join(root, "projects.ts"), "utf8");
    expect(t).not.toMatch(/prisma\.\s*paymentAgreement/i);
    expect(t).not.toMatch(/paymentAgreement\.find/i);
    expect(t).toMatch(/unavailablePortfolio: true/);
    expect(t).toMatch(/nenhum zero exibido/);
  });
  it("relatório não persiste snapshot e audit só metadados", () => {
    const t = readFileSync(path.join(process.cwd(), "src/lib/diretor/reports/generate.ts"), "utf8");
    expect(t).not.toMatch(/prisma\./);
    expect(t).toMatch(/createAuditLog/);
    expect(t).toMatch(/diff: \{ type: input.type, format: input.format, generatedAt/);
    expect(t).toMatch(/Sem dados pessoais nominais/);
  });
});
