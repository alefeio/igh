import { config as loadEnv } from "dotenv";
import { describe, expect, it, vi } from "vitest";

loadEnv();

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DIRECTOR_PERF === "1";

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
    warmMedianMs:
      samples.length > 1
        ? Math.round(
            ([...samples.slice(1)].sort((a, b) => a - b)[
              Math.floor((samples.length - 1) / 2)
            ] ?? 0) * 10,
          ) / 10
        : Math.round(samples[0] * 10) / 10,
    samples: samples.map((s) => Math.round(s * 10) / 10),
    bytes,
    last,
  };
}

describe.skipIf(!enabled)("diretor loader performance (DB)", () => {
  it(
    "mede tamanhos e tempos (legado 3x + bundle 10x)",
    async () => {
      const { resolveDirectorScope } = await import("@/lib/diretor/load-scope");
      const { loadAcademicOfferBundle } = await import("@/lib/diretor/metrics/academic-offer");
      const { getDirectorDashboardData } = await import("@/lib/director-dashboard-data");

      const scope = await resolveDirectorScope({ scope: "current" });

      console.log("[perf] aquecimento bundle...");
      await loadAcademicOfferBundle(scope, {}, "DIRECTOR");

      // Legado: 3 execuções (cada ~1–2 min no ambiente atual). Mediana de 3 + cold documentados.
      const legacy = await timed("legacy", () => getDirectorDashboardData({ scope: "current" }), 3);
      const bundle = await timed("bundle1A", () => loadAcademicOfferBundle(scope, {}, "DIRECTOR"), 10);

      const full = bundle.last!;
      const overviewPayload = {
        meta: full.meta,
        kpis: full.kpis.slice(0, 6),
        alerts: full.alerts.filter((a) => a.severity === "critical").slice(0, 5),
        qualityNotes: full.qualityNotes,
      };
      const overviewBytes = Buffer.byteLength(JSON.stringify(overviewPayload), "utf8");
      const academicBytes = Buffer.byteLength(JSON.stringify(full.academic), "utf8");
      const offerBytes = Buffer.byteLength(JSON.stringify(full.offer), "utf8");
      const prioritiesBytes = Buffer.byteLength(JSON.stringify(full.alerts), "utf8");
      const thematicSum = overviewBytes + academicBytes + offerBytes + prioritiesBytes;

      // Mediana de tamanho do overview em 10 serializações (payload estável)
      const overviewSizeSamples: number[] = [];
      for (let i = 0; i < 10; i++) {
        overviewSizeSamples.push(Buffer.byteLength(JSON.stringify(overviewPayload), "utf8"));
      }

      const report = {
        classGroups: scope.classGroupIds.length,
        cycleLabel: scope.cycleLabel,
        methodology: {
          legacyRuns: 3,
          bundleRuns: 10,
          note:
            "Legado ~100s/run no banco remoto; mediana temporal do legado com n=3. Bundle 1A com n=10. Tamanhos medidos no payload real.",
        },
        legacy: {
          coldMs: legacy.coldMs,
          warmMedianMs: legacy.warmMedianMs,
          medianMs: legacy.medianMs,
          bytes: legacy.bytes,
          samples: legacy.samples,
        },
        bundle1A: {
          coldMs: bundle.coldMs,
          warmMedianMs: bundle.warmMedianMs,
          medianMs: bundle.medianMs,
          bytesFull: bundle.bytes,
          samples: bundle.samples,
        },
        payloads: {
          overviewBytes,
          overviewBytesMedianOf10: overviewSizeSamples[5],
          academicBytes,
          offerBytes,
          prioritiesBytes,
          thematicSumBytes: thematicSum,
        },
        overviewVsLegacyReductionPct:
          legacy.bytes > 0
            ? Math.round((1 - overviewBytes / legacy.bytes) * 1000) / 10
            : null,
        thematicSumVsLegacyPct:
          legacy.bytes > 0
            ? Math.round((thematicSum / legacy.bytes) * 1000) / 10
            : null,
      };

      console.log("[perf-report]", JSON.stringify(report));
      expect(overviewBytes).toBeLessThan(legacy.bytes);
      expect(legacy.bytes).toBeGreaterThan(0);
    },
    900_000,
  );
});
