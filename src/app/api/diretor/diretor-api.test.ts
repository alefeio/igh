import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/diretor/metrics/academic-offer", () => ({
  loadAcademicOfferBundle: vi.fn(async (_scope: unknown, _filters: unknown, viewer: string) => ({
    meta: {
      generatedAt: "2026-08-21T12:00:00.000Z",
      dataAsOf: "2026-08-21T12:00:00.000Z",
      filters: { scope: "current", cycleId: "11111111-1111-1111-1111-111111111111" },
      quality: [{ domain: "academic", status: "ok" }],
      formulaVersion: "1A.0.0",
      viewer,
    },
    kpis: [
      {
        metricId: "offer.occupancy.current",
        label: "Ocupação atual",
        value: 50,
        unit: "%",
        quality: "ok",
        formulaVersion: "1A.0.0",
        formula: "ocupantes ÷ capacidade",
      },
    ],
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
      demandCompletionMatrix: [],
    },
    alerts: [],
    qualityNotes: [],
  })),
}));

import { requireDirectorRead } from "@/lib/diretor/auth";
import { GET as getOverview, POST as postOverview } from "@/app/api/diretor/overview/route";
import { GET as getPriorities } from "@/app/api/diretor/priorities/route";
import { GET as getAcademic } from "@/app/api/diretor/academic/route";
import { GET as getOffer } from "@/app/api/diretor/offer-territories/route";
import { GET as getGuide, POST as postGuide } from "@/app/api/diretor/guide/route";

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
  });
});
