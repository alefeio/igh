/**
 * Benchmark dos loaders (sem HTTP). Usa o mesmo banco do .env.
 *   node --require ./scripts/stub-server-only.cjs ./node_modules/tsx/dist/cli.mjs scripts/diretor-loader-benchmark.ts
 */
import "dotenv/config";

async function timed<T>(fn: () => Promise<T>, runs: number) {
  const samples: number[] = [];
  let last: T | null = null;
  let bytes = 0;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    last = await fn();
    samples.push(performance.now() - t0);
    bytes = Buffer.byteLength(JSON.stringify(last), "utf8");
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return {
    medianMs: Math.round(median * 10) / 10,
    coldMs: Math.round(samples[0] * 10) / 10,
    warmMedianMs:
      Math.round(
        ([...samples.slice(1)].sort((a, b) => a - b)[Math.floor((samples.length - 1) / 2)] ??
          median) * 10,
      ) / 10,
    samples: samples.map((s) => Math.round(s * 10) / 10),
    bytes,
    last,
  };
}

async function main() {
  const { resolveDirectorScope } = await import("../src/lib/diretor/load-scope");
  const { loadAcademicOfferBundle } = await import("../src/lib/diretor/metrics/academic-offer");
  const { getCachedDirectorDashboard } = await import("../src/lib/director-dashboard-data");

  const scope = await resolveDirectorScope({ scope: "current" });

  const legacy = await timed(
    () => getCachedDirectorDashboard({ scope: "current" }),
    10,
  );
  const bundle = await timed(() => loadAcademicOfferBundle(scope, {}, "DIRECTOR"), 10);

  const full = bundle.last!;
  const overviewPayload = {
    meta: full.meta,
    cycleLabel: scope.cycleLabel,
    cycles: scope.cycles,
    kpis: full.kpis.slice(0, 6),
    alerts: full.alerts.filter((a) => a.severity === "critical").slice(0, 5),
    qualityNotes: full.qualityNotes,
  };
  const overviewBytes = Buffer.byteLength(JSON.stringify(overviewPayload), "utf8");
  const academicBytes = Buffer.byteLength(JSON.stringify(full.academic), "utf8");
  const offerBytes = Buffer.byteLength(JSON.stringify(full.offer), "utf8");
  const prioritiesBytes = Buffer.byteLength(JSON.stringify(full.alerts), "utf8");
  const thematicSum = overviewBytes + academicBytes + offerBytes + prioritiesBytes;

  console.log(
    JSON.stringify(
      {
        ok: true,
        dataAsOf: scope.dataAsOf.toISOString(),
        cycleLabel: scope.cycleLabel,
        classGroups: scope.classGroupIds.length,
        legacyMonolith: {
          coldMs: legacy.coldMs,
          warmMedianMs: legacy.warmMedianMs,
          medianMs: legacy.medianMs,
          bytes: legacy.bytes,
        },
        academicOfferBundleLoader: {
          coldMs: bundle.coldMs,
          warmMedianMs: bundle.warmMedianMs,
          medianMs: bundle.medianMs,
          bytesFullBundle: bundle.bytes,
        },
        payloads: {
          overviewHttpLikeBytes: overviewBytes,
          academicBytes,
          offerBytes,
          prioritiesBytes,
          thematicSumBytes: thematicSum,
        },
        comparison: {
          overviewVsLegacyBytesReductionPct:
            legacy.bytes > 0
              ? Math.round((1 - overviewBytes / legacy.bytes) * 1000) / 10
              : null,
          overviewVsLegacyBytesRatio:
            legacy.bytes > 0 ? Math.round((overviewBytes / legacy.bytes) * 1000) / 1000 : null,
          note:
            "Medição via loaders (mesmo banco). Overview HTTP seria próximo de overviewHttpLikeBytes. O loader 1A ainda calcula academic+offer juntos (limitação); a Visão Geral só serializa a fatia overview.",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
