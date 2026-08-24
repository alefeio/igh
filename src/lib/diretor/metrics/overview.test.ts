import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/diretor/facts/academic", () => ({ loadAcademicExecutiveFacts: vi.fn() }));
vi.mock("@/lib/diretor/facts/offer", () => ({ loadOfferExecutiveFacts: vi.fn() }));
vi.mock("@/lib/diretor/facts/financial", () => ({ loadFinancialExecutiveFacts: vi.fn() }));
vi.mock("@/lib/diretor/facts/social", () => ({ loadSocialExecutiveFacts: vi.fn() }));
vi.mock("@/lib/diretor/facts/administrative", () => ({ loadAdministrativeExecutiveFacts: vi.fn() }));
vi.mock("@/lib/diretor/facts/projects", () => ({ loadProjectExecutiveFacts: vi.fn() }));
vi.mock("@/lib/employees", () => ({
  formatCentsBRL: (n: number) => `R$ ${(n / 100).toFixed(2)}`,
}));

import { loadAcademicExecutiveFacts } from "@/lib/diretor/facts/academic";
import { loadOfferExecutiveFacts } from "@/lib/diretor/facts/offer";
import { loadFinancialExecutiveFacts } from "@/lib/diretor/facts/financial";
import { loadSocialExecutiveFacts } from "@/lib/diretor/facts/social";
import { loadAdministrativeExecutiveFacts } from "@/lib/diretor/facts/administrative";
import { loadProjectExecutiveFacts } from "@/lib/diretor/facts/projects";
import { loadOverviewSummaries } from "@/lib/diretor/metrics/overview";

const scope = {
  scope: "current" as const,
  cycleId: "c1",
  cycleLabel: "Ciclo",
  classGroupIds: [] as string[],
  cycles: [],
  dataAsOf: new Date("2026-08-21T12:00:00.000Z"),
};

const q = [{ domain: "x", status: "ok" as const }];

describe("overview facts", () => {
  beforeEach(() => {
    vi.mocked(loadAcademicExecutiveFacts).mockReset();
    vi.mocked(loadOfferExecutiveFacts).mockReset();
    vi.mocked(loadFinancialExecutiveFacts).mockReset();
    vi.mocked(loadSocialExecutiveFacts).mockReset();
    vi.mocked(loadAdministrativeExecutiveFacts).mockReset();
    vi.mocked(loadProjectExecutiveFacts).mockReset();
  });

  it("tolera falha parcial de um domínio", async () => {
    vi.mocked(loadAcademicExecutiveFacts).mockRejectedValue(new Error("boom"));
    vi.mocked(loadOfferExecutiveFacts).mockResolvedValue({
      occupancyPercent: 50,
      emptyClasses: 0,
      below30: 0,
      waitlist: 0,
      periodLabel: "c",
      quality: [{ domain: "offer", status: "ok" }],
      qualityNotes: [],
    });
    vi.mocked(loadFinancialExecutiveFacts).mockResolvedValue({
      netPaidCents: 100,
      apCents: 0,
      arCents: 0,
      openAge91PlusCents: 0,
      periodLabel: "c",
      quality: [{ domain: "financial", status: "ok" }],
      qualityNotes: [],
    });
    vi.mocked(loadSocialExecutiveFacts).mockResolvedValue({
      computersDonated: 1,
      computersTarget: 10,
      computersProgressPct: 10,
      periodLabel: "2026",
      quality: q,
      qualityNotes: [],
    });
    vi.mocked(loadAdministrativeExecutiveFacts).mockResolvedValue({
      contractsExpired: 0,
      pendingDocuments: 0,
      inventoryZero: 0,
      inventoryBelowMin: 0,
      stockCritical: 0,
      periodLabel: "e",
      quality: [{ domain: "administrative", status: "ok" }],
      qualityNotes: [],
    });
    vi.mocked(loadProjectExecutiveFacts).mockResolvedValue({
      unavailable: true,
      periodLabel: "2026",
      quality: [{ domain: "projects", status: "unavailable", note: "inexistente" }],
      qualityNotes: [],
    });

    const r = await loadOverviewSummaries({ scope, viewer: "DIRECTOR" });
    expect(r.domainStatus.some((d) => d.domain === "academic" && d.status === "unavailable")).toBe(true);
    expect(r.kpis.some((k) => k.metricId === "offer.occupancy.current")).toBe(true);
    expect(r.domainStatus.some((d) => d.domain === "projects" && d.status === "unavailable")).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/cpf/i);
    expect(JSON.stringify(r)).not.toMatch(/vencid/i);
  });
});

describe("overview 1C", () => {
  it("usa fatos executivos e não loaders temáticos", () => {
    const t = readFileSync(path.join(process.cwd(), "src/lib/diretor/metrics/overview.ts"), "utf8");
    expect(t).toMatch(/loadAcademicExecutiveFacts/);
    expect(t).toMatch(/alertsFromExecutiveFacts/);
    expect(t).not.toMatch(/loadAcademic\(/);
    expect(t).not.toMatch(/summarizeAcademic/);
    expect(t).not.toMatch(/loadAcademicOfferBundle/);
  });
});
