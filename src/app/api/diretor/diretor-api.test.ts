import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/diretor/auth", () => ({
  requireDirectorRead: vi.fn(),
}));

vi.mock("@/lib/diretor/load-scope", () => ({
  resolveDirectorScope: vi.fn(async () => ({
    scope: "current",
    cycleId: "11111111-1111-1111-1111-111111111111",
    cycleLabel: "Ciclo teste",
    classGroupIds: [],
    cycles: [],
    dataAsOf: new Date("2026-08-21T12:00:00.000Z"),
  })),
}));

vi.mock("@/lib/diretor/metrics/overview", () => ({
  loadOverviewSummaries: vi.fn(async (opts: { viewer: string }) => ({
    meta: {
      generatedAt: "2026-08-21T12:00:00.000Z",
      dataAsOf: "2026-08-21T12:00:00.000Z",
      filters: { scope: "current", cycleId: "11111111-1111-4111-8111-111111111111" },
      quality: [{ domain: "academic", status: "ok" }],
      formulaVersion: "1B.0.0",
      viewer: opts.viewer,
    },
    kpis: [
      {
        metricId: "soc.served_unique",
        label: "Atendidos",
        value: 10,
        quality: "ok",
        formulaVersion: "1B.0.0",
        formula: "distinct",
      },
    ],
    alerts: [],
    qualityNotes: [],
    domainStatus: [{ domain: "academic", status: "ok" }],
  })),
}));

const emptyMeta = (viewer: string, domain: string) => ({
  generatedAt: "2026-08-21T12:00:00.000Z",
  dataAsOf: "2026-08-21T12:00:00.000Z",
  filters: { scope: "current" },
  quality: [{ domain, status: "ok" as const }],
  formulaVersion: "1B.0.0",
  viewer,
});

vi.mock("@/lib/diretor/metrics/academic", () => ({
  loadAcademic: vi.fn(async (_s: unknown, _f: unknown, viewer: string) => ({
    meta: emptyMeta(viewer, "academic"),
    kpis: [],
    academic: {
      funnel: {
        preEnrollments: 0,
        confirmed: 0,
        started: 0,
        completedStarted: null,
        completionStartedRate: null,
        nonStartRateAmongConfirmed: null,
        cancelAfterStartUntyped: 0,
      },
      attendance: {
        opportunities: 0,
        presentCount: 0,
        justifiedCount: 0,
        unjustifiedCount: 0,
        unmarkedCount: 0,
        markedCount: 0,
        callCompletenessRate: null,
        presentRate: null,
        justifiedRate: null,
        unjustifiedRate: null,
        quality: "unavailable",
      },
      suspensions: 0,
      criticalAbsenceRisk: 0,
      servedUnique: 0,
      byCourse: [],
    },
    alerts: [],
    qualityNotes: [],
  })),
}));

vi.mock("@/lib/diretor/metrics/offer", () => ({
  loadOffer: vi.fn(async (_s: unknown, _f: unknown, viewer: string) => ({
    meta: emptyMeta(viewer, "offer"),
    kpis: [],
    offer: {
      capacity: 0,
      occupied: 0,
      occupancyPercent: null,
      emptyClasses: 0,
      below30: 0,
      ge80: 0,
      full: 0,
      waitlist: 0,
      seatOffers: { pending: 0, accepted: 0, expired: 0, cancelled: 0, acceptRate: null },
      territories: [],
      demandUniqueCount: 0,
      byCourse: [],
      demandNote: "separado",
    },
    alerts: [],
    qualityNotes: [],
  })),
}));

vi.mock("@/lib/diretor/metrics/financial", () => ({
  loadFinancial: vi.fn(async () => ({ alerts: [], meta: emptyMeta("DIRECTOR", "financial"), qualityNotes: [] })),
}));
vi.mock("@/lib/diretor/metrics/administrative", () => ({
  loadAdministrative: vi.fn(async () => ({ alerts: [], meta: emptyMeta("DIRECTOR", "administrative"), qualityNotes: [] })),
}));
vi.mock("@/lib/diretor/metrics/social", () => ({
  loadSocialImpact: vi.fn(async () => ({ alerts: [], meta: emptyMeta("DIRECTOR", "social"), qualityNotes: [] })),
}));
vi.mock("@/lib/diretor/metrics/projects", () => ({
  loadProjects: vi.fn(async () => ({
    meta: emptyMeta("DIRECTOR", "projects"),
    unavailablePortfolio: true,
    notice: "sem cadastro",
    qualityNotes: [],
  })),
}));
vi.mock("@/lib/diretor/reports/generate", () => ({
  REPORT_CATALOG: [{ type: "executive", title: "Executivo do período", domain: "overview" }],
  generateDirectorReport: vi.fn(async () => ({
    format: "json",
    filename: "diretor-executive.json",
    body: "{}",
    report: { title: "Executivo", institution: "IGH", generatedAt: "x", dataAsOf: "y" },
  })),
}));

import { requireDirectorRead } from "@/lib/diretor/auth";
import { GET as getOverview, POST as postOverview } from "@/app/api/diretor/overview/route";
import { GET as getPriorities } from "@/app/api/diretor/priorities/route";
import { GET as getAcademic } from "@/app/api/diretor/academic/route";
import { GET as getOffer } from "@/app/api/diretor/offer-territories/route";
import { GET as getGuide, POST as postGuide } from "@/app/api/diretor/guide/route";
import { GET as getFinancial, POST as postFinancial } from "@/app/api/diretor/financial/route";
import { GET as getReports } from "@/app/api/diretor/reports/route";
import { GET as getGenerate, POST as postGenerate } from "@/app/api/diretor/reports/generate/route";
import { GET as getSocial, POST as postSocial } from "@/app/api/diretor/social-impact/route";
import { GET as getAdmin, POST as postAdmin } from "@/app/api/diretor/administrative/route";
import { GET as getProjects, POST as postProjects } from "@/app/api/diretor/projects/route";

const requireDirectorReadMock = vi.mocked(requireDirectorRead);

function assertNoPii(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text.toLowerCase()).not.toContain('"cpf"');
  expect(text.toLowerCase()).not.toContain('"telefone"');
  expect(text.toLowerCase()).not.toContain('"phone"');
  expect(text).not.toMatch(/"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"/);
}

describe("APIs diretor — autorização e contrato", () => {
  beforeEach(() => {
    requireDirectorReadMock.mockReset();
  });

  it("não autenticado → 401", async () => {
    requireDirectorReadMock.mockRejectedValue(new Error("UNAUTHENTICATED"));
    const res = await getOverview(new Request("http://localhost/api/diretor/overview"));
    expect(res.status).toBe(401);
  });

  it("perfil sem autorização → 403", async () => {
    requireDirectorReadMock.mockRejectedValue(new Error("FORBIDDEN"));
    const res = await getAcademic(new Request("http://localhost/api/diretor/academic"));
    expect(res.status).toBe(403);
  });

  it("DIRECTOR lê overview com meta e sem PII", async () => {
    requireDirectorReadMock.mockResolvedValue({
      id: "u1",
      name: "Dir",
      email: "d@x.com",
      role: "DIRECTOR",
      isActive: true,
      mustChangePassword: false,
      viewer: "DIRECTOR",
    } as never);
    const res = await getOverview(
      new Request("http://localhost/api/diretor/overview?scope=current"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.meta.dataAsOf).toBeTruthy();
    expect(json.data.meta.generatedAt).toBeTruthy();
    expect(json.data.meta.formulaVersion || json.data.meta.quality).toBeTruthy();
    expect(json.data.meta.filters.scope).toBe("current");
    assertNoPii(json.data);
  });

  it("MASTER lê guide em preview", async () => {
    requireDirectorReadMock.mockResolvedValue({
      id: "m1",
      name: "Master",
      email: "m@x.com",
      role: "MASTER",
      isActive: true,
      mustChangePassword: false,
      viewer: "MASTER",
    } as never);
    const res = await getGuide();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.meta.viewer).toBe("MASTER");
    assertNoPii(json.data);
  });

  it("filtros inválidos → 400", async () => {
    requireDirectorReadMock.mockResolvedValue({
      id: "u1",
      name: "Dir",
      email: "d@x.com",
      role: "DIRECTOR",
      isActive: true,
      mustChangePassword: false,
      viewer: "DIRECTOR",
    } as never);
    const res = await getOffer(
      new Request("http://localhost/api/diretor/offer-territories?cycleId=not-a-uuid&scope=cycle"),
    );
    expect(res.status).toBe(400);
  });

  it("priorities reflete severity em meta.filters", async () => {
    requireDirectorReadMock.mockResolvedValue({
      id: "u1",
      name: "Dir",
      email: "d@x.com",
      role: "DIRECTOR",
      isActive: true,
      mustChangePassword: false,
      viewer: "DIRECTOR",
    } as never);
    const res = await getPriorities(
      new Request("http://localhost/api/diretor/priorities?severity=critical&domain=academic"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.meta.filters.severity).toBe("critical");
    expect(json.data.meta.filters.domain).toBe("academic");
  });

  it("POST → 405", async () => {
    const res = await postOverview();
    expect(res.status).toBe(405);
    const res2 = await postGuide();
    expect(res2.status).toBe(405);
    expect((await postFinancial()).status).toBe(405);
    expect((await getGenerate()).status).toBe(405);
    expect((await postSocial()).status).toBe(405);
    expect((await postAdmin()).status).toBe(405);
    expect((await postProjects()).status).toBe(405);
  });

  it("financeiro 401 e reports catálogo", async () => {
    requireDirectorReadMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    expect((await getFinancial(new Request("http://localhost/api/diretor/financial"))).status).toBe(401);
    requireDirectorReadMock.mockResolvedValue({
      id: "u1",
      name: "Dir",
      email: "d@x.com",
      role: "DIRECTOR",
      isActive: true,
      mustChangePassword: false,
      viewer: "DIRECTOR",
    } as never);
    const reports = await getReports();
    expect(reports.status).toBe(200);
    const json = await reports.json();
    expect(json.data.catalog.length).toBeGreaterThan(0);
    expect(JSON.stringify(json.data)).not.toMatch(/projetos institucionais fictícios/i);
    requireDirectorReadMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    expect((await getSocial(new Request("http://localhost/api/diretor/social-impact"))).status).toBe(401);
    requireDirectorReadMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    expect((await getAdmin(new Request("http://localhost/api/diretor/administrative"))).status).toBe(401);
    requireDirectorReadMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    expect((await getProjects(new Request("http://localhost/api/diretor/projects"))).status).toBe(401);
  });

  it("POST generate relatórios (json) sem PII", async () => {
    requireDirectorReadMock.mockResolvedValue({
      id: "u1",
      name: "Dir",
      email: "d@x.com",
      role: "DIRECTOR",
      isActive: true,
      mustChangePassword: false,
      viewer: "DIRECTOR",
    } as never);
    const res = await postGenerate(
      new Request("http://localhost/api/diretor/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "executive", format: "json" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.filename).toContain("executive");
    assertNoPii(json.data);
  });
});
