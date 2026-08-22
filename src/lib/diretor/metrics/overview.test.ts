import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/diretor/metrics/academic", () => ({
  summarizeAcademic: vi.fn(),
}));
vi.mock("@/lib/diretor/metrics/offer", () => ({
  summarizeOffer: vi.fn(),
}));
vi.mock("@/lib/diretor/metrics/financial", () => ({
  summarizeFinancial: vi.fn(),
}));
vi.mock("@/lib/diretor/metrics/social", () => ({
  summarizeSocial: vi.fn(),
}));
vi.mock("@/lib/diretor/metrics/administrative", () => ({
  summarizeAdministrative: vi.fn(),
}));
vi.mock("@/lib/employees", () => ({
  formatCentsBRL: (n: number) => `R$ ${(n / 100).toFixed(2)}`,
}));

import { summarizeAcademic } from "@/lib/diretor/metrics/academic";
import { summarizeAdministrative } from "@/lib/diretor/metrics/administrative";
import { summarizeFinancial } from "@/lib/diretor/metrics/financial";
import { summarizeOffer } from "@/lib/diretor/metrics/offer";
import { summarizeSocial } from "@/lib/diretor/metrics/social";
import { loadOverviewSummaries } from "@/lib/diretor/metrics/overview";
import { readFileSync } from "node:fs";
import path from "node:path";

const scope = {
  scope: "current" as const,
  cycleId: "c1",
  cycleLabel: "Ciclo",
  classGroupIds: [] as string[],
  cycles: [],
  dataAsOf: new Date("2026-08-21T12:00:00.000Z"),
};

describe("overview summaries", () => {
  beforeEach(() => {
    vi.mocked(summarizeAcademic).mockReset();
    vi.mocked(summarizeOffer).mockReset();
    vi.mocked(summarizeFinancial).mockReset();
    vi.mocked(summarizeSocial).mockReset();
    vi.mocked(summarizeAdministrative).mockReset();
  });

  it("tolera falha parcial de um domínio", async () => {
    vi.mocked(summarizeAcademic).mockRejectedValue(new Error("boom"));
    vi.mocked(summarizeOffer).mockResolvedValue({
      occupancyPercent: 50,
      waitlist: 0,
      emptyClasses: 0,
      below30: 0,
      quality: [{ domain: "offer", status: "ok" }],
      qualityNotes: [],
      alerts: [],
    });
    vi.mocked(summarizeFinancial).mockResolvedValue({
      netPaidCents: 100,
      overdueCents: 0,
      qualityNotes: [],
      quality: [{ domain: "financial", status: "ok" }],
      alerts: [],
    });
    vi.mocked(summarizeSocial).mockResolvedValue({
      servedUnique: 7,
      computersDonated: 1,
      computersTarget: 10,
      computersProgressPct: 10,
      quality: [{ domain: "social", status: "ok" }],
      qualityNotes: [],
      alerts: [],
    });
    vi.mocked(summarizeAdministrative).mockResolvedValue({
      contractsExpired: 0,
      pendingDocuments: 0,
      stockCritical: 0,
      quality: [{ domain: "administrative", status: "ok" }],
      qualityNotes: [],
      alerts: [],
    });

    const r = await loadOverviewSummaries({ scope, viewer: "DIRECTOR" });
    expect(r.domainStatus.some((d) => d.domain === "academic" && d.status === "unavailable")).toBe(true);
    expect(r.kpis.length).toBeGreaterThan(0);
    expect(r.kpis.some((k) => k.metricId === "soc.served_unique")).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/cpf/i);
  });
});

describe("overview não usa payload monolítico", () => {
  it("não importa loadAcademicOfferBundle nem loadAcademic completo", () => {
    const t = readFileSync(path.join(process.cwd(), "src/lib/diretor/metrics/overview.ts"), "utf8");
    expect(t).not.toMatch(/loadAcademicOfferBundle/);
    expect(t).not.toMatch(/loadAcademic\(/);
    expect(t).toMatch(/summarizeAcademic/);
  });
});
