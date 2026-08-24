import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv();

vi.mock("server-only", () => ({}));

/** Prisma 7 gera em src/generated/prisma (gitignored), não em node_modules/.prisma/client. */
const prismaReady =
  existsSync("src/generated/prisma/client.ts") ||
  existsSync("src/generated/prisma/client.js") ||
  existsSync("node_modules/.prisma/client/index.js");
const enabled = process.env.RUN_DIRECTOR_PERF === "1" && prismaReady;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return Math.round(sorted[idx] * 10) / 10;
}

async function timed<T>(label: string, fn: () => Promise<T>, runs: number) {
  const samples: number[] = [];
  let last: T | null = null;
  let bytes = 0;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    last = await fn();
    const ms = performance.now() - t0;
    samples.push(ms);
    bytes = Buffer.byteLength(JSON.stringify(last), "utf8");
    console.log(`[perf:${label}] run ${i + 1}/${runs}: ${Math.round(ms)}ms bytes=${bytes}`);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    coldMs: Math.round(samples[0] * 10) / 10,
    medianMs: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10,
    p95Ms: p95(samples),
    warmMedianMs:
      samples.length > 1
        ? Math.round(
            ([...samples.slice(1)].sort((a, b) => a - b)[Math.floor((samples.length - 1) / 2)] ?? 0) * 10,
          ) / 10
        : Math.round(samples[0] * 10) / 10,
    samples: samples.map((s) => Math.round(s * 10) / 10),
    bytes,
    last,
  };
}

describe.skipIf(!enabled)("diretor loader performance 1C (DB)", () => {
  it(
    "mede tempo de processamento dos loaders (não TTFB) em todos os domínios 1C",
    async () => {
      const { resolveDirectorScope } = await import("@/lib/diretor/load-scope");
      const { getDirectorDashboardData } = await import("@/lib/director-dashboard-data");
      const { loadOverviewSummaries } = await import("@/lib/diretor/metrics/overview");
      const { loadAcademic } = await import("@/lib/diretor/metrics/academic");
      const { loadOffer } = await import("@/lib/diretor/metrics/offer");
      const { loadSocialImpact } = await import("@/lib/diretor/metrics/social");
      const { loadFinancial } = await import("@/lib/diretor/metrics/financial");
      const { loadProjects } = await import("@/lib/diretor/metrics/projects");
      const { loadAdministrative } = await import("@/lib/diretor/metrics/administrative");
      const { loadAcademicExecutiveFacts } = await import("@/lib/diretor/facts/academic");
      const { loadOfferExecutiveFacts } = await import("@/lib/diretor/facts/offer");
      const { loadFinancialExecutiveFacts } = await import("@/lib/diretor/facts/financial");
      const { loadSocialExecutiveFacts } = await import("@/lib/diretor/facts/social");
      const { loadAdministrativeExecutiveFacts } = await import("@/lib/diretor/facts/administrative");
      const { loadProjectExecutiveFacts } = await import("@/lib/diretor/facts/projects");
      const { alertsFromExecutiveFacts } = await import("@/lib/diretor/alerts/engine");
      const { REPORT_CATALOG } = await import("@/lib/diretor/reports/generate");
      const { defaultCompetence } = await import("@/lib/diretor/period");

      const { prisma } = await import("@/lib/prisma");
      const asOf = process.env.DIRECTOR_PERF_DATA_AS_OF
        ? new Date(process.env.DIRECTOR_PERF_DATA_AS_OF)
        : new Date("2026-08-21T12:00:00.000Z");
      const cycle3 = await prisma.cycle.findFirst({ where: { year: 2026, cycle: 3 }, select: { id: true } });
      const scope = cycle3
        ? await resolveDirectorScope({ scope: "cycle", cycleId: cycle3.id, dataAsOf: asOf })
        : await resolveDirectorScope({ scope: "current", dataAsOf: asOf });
      if (!cycle3) console.warn("[perf] ciclo 3/2026 não encontrado; usando ciclo atual");
      const competence = defaultCompetence(scope.dataAsOf);
      const viewer = "DIRECTOR" as const;
      const runs = 10;
      const legacyRuns = Number(process.env.DIRECTOR_PERF_LEGACY_RUNS ?? 3);

      console.log("[perf] ciclo", scope.cycleLabel, "turmas", scope.classGroupIds.length, "dataAsOf", asOf.toISOString());

      const legacy = await timed("legacy", () => getDirectorDashboardData({ scope: "current" }), legacyRuns);
      const overview = await timed("overview", () => loadOverviewSummaries({ scope, viewer }), runs);
      const academic = await timed("academic", () => loadAcademic(scope, {}, viewer), runs);
      const offer = await timed("offer-territories", () => loadOffer(scope, {}, viewer), runs);
      const social = await timed("social-impact", () => loadSocialImpact({}, viewer), runs);
      const financial = await timed("financial", () => loadFinancial({ competence }, viewer), runs);
      const projects = await timed("projects", () => loadProjects({}, viewer), runs);
      const administrative = await timed("administrative", () => loadAdministrative({ competence }, viewer), runs);
      const reportsCatalog = await timed("reports-catalog", async () => ({ catalog: REPORT_CATALOG }), runs);

      const sAcad = await timed("facts.academic", () => loadAcademicExecutiveFacts(scope, viewer), runs);
      const sOffer = await timed("facts.offer", () => loadOfferExecutiveFacts(scope, viewer), runs);
      const sFin = await timed("facts.financial", () => loadFinancialExecutiveFacts({ competence }, viewer, asOf), runs);
      const sSocial = await timed("facts.social", () => loadSocialExecutiveFacts(viewer, asOf), runs);
      const sAdmin = await timed("facts.admin", () => loadAdministrativeExecutiveFacts(viewer, asOf), runs);
      const sProj = await timed("facts.projects", () => loadProjectExecutiveFacts(viewer), runs);
      const sAlerts = await timed("overview.alerts-engine", async () =>
        alertsFromExecutiveFacts({
          academic: sAcad.last || undefined,
          offer: sOffer.last || undefined,
          financial: sFin.last || undefined,
          social: sSocial.last || undefined,
          administrative: sAdmin.last || undefined,
          projects: sProj.last || undefined,
        }),
        runs,
      );

      const { mapSettledLimit } = await import("@/lib/diretor/concurrency");
      const priorities = await timed(
        "priorities",
        async () => {
          const settled = await mapSettledLimit(
            [
              { label: "academic", run: () => loadAcademicExecutiveFacts(scope, viewer) },
              { label: "offer", run: () => loadOfferExecutiveFacts(scope, viewer) },
              { label: "financial", run: () => loadFinancialExecutiveFacts({ competence }, viewer, asOf) },
              { label: "social", run: () => loadSocialExecutiveFacts(viewer, asOf) },
              { label: "administrative", run: () => loadAdministrativeExecutiveFacts(viewer, asOf) },
              { label: "projects", run: () => loadProjectExecutiveFacts(viewer) },
            ],
            2,
          );
          const by = Object.fromEntries(settled.map((s) => [s.label, s]));
          return alertsFromExecutiveFacts({
            academic: by.academic?.ok ? (by.academic.value as NonNullable<typeof sAcad.last>) : undefined,
            offer: by.offer?.ok ? (by.offer.value as NonNullable<typeof sOffer.last>) : undefined,
            financial: by.financial?.ok ? (by.financial.value as NonNullable<typeof sFin.last>) : undefined,
            social: by.social?.ok ? (by.social.value as NonNullable<typeof sSocial.last>) : undefined,
            administrative: by.administrative?.ok
              ? (by.administrative.value as NonNullable<typeof sAdmin.last>)
              : undefined,
            projects: by.projects?.ok ? (by.projects.value as NonNullable<typeof sProj.last>) : undefined,
          });
        },
        runs,
      );

      const pack = (r: Awaited<ReturnType<typeof timed>>) => ({
        coldMs: r.coldMs,
        medianMs: r.medianMs,
        p95Ms: r.p95Ms,
        warmMedianMs: r.warmMedianMs,
        bytes: r.bytes,
        samples: r.samples,
        label: "tempo de processamento dos loaders (não TTFB)",
      });

      const report = {
        metricKind: "loader_processing_time",
        classGroups: scope.classGroupIds.length,
        cycleLabel: scope.cycleLabel,
        dataAsOf: asOf.toISOString(),
        competence,
        runs,
        legacyRuns,
        domains: {
          legacy: pack(legacy),
          overview: pack(overview),
          priorities: pack(priorities),
          academic: pack(academic),
          "offer-territories": pack(offer),
          "social-impact": pack(social),
          financial: pack(financial),
          projects: pack(projects),
          administrative: pack(administrative),
          reports: pack(reportsCatalog),
        },
        overviewDecomposition: {
          academic: pack(sAcad),
          offer: pack(sOffer),
          social: pack(sSocial),
          financial: pack(sFin),
          administrative: pack(sAdmin),
          projects: pack(sProj),
          alertsEngine: pack(sAlerts),
        },
      };
      console.log("[perf-report-1c]", JSON.stringify(report));
      mkdirSync("tmp/homologacao-1c", { recursive: true });
      writeFileSync("tmp/homologacao-1c/benchmark-1c.json", JSON.stringify(report, null, 2));
      expect(overview.bytes).toBeLessThan(legacy.bytes);
      expect(overview.medianMs).toBeGreaterThan(0);
    },
    5_400_000,
  );
});
