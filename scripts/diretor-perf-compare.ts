/**
 * Medição comparativa (rodar com servidor local + cookie de sessão Diretor/Master):
 *   npx tsx scripts/diretor-perf-compare.ts
 *
 * Sem AUTH_COOKIE, apenas documenta o protocolo e sai 0.
 */
import "dotenv/config";

async function timeGet(url: string, cookie?: string) {
  const started = performance.now();
  const res = await fetch(url, {
    headers: cookie ? { cookie: `auth_token=${cookie}` } : {},
  });
  const text = await res.text();
  const ms = performance.now() - started;
  return { status: res.status, bytes: Buffer.byteLength(text, "utf8"), ms };
}

async function main() {
  const base = process.env.DIRECTOR_PERF_BASE_URL ?? "http://127.0.0.1:3000";
  const cookie = process.env.DIRECTOR_PERF_AUTH_COOKIE;
  if (!cookie) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message:
            "Defina DIRECTOR_PERF_AUTH_COOKIE (valor do auth_token) e opcionalmente DIRECTOR_PERF_BASE_URL para medir.",
          protocol: {
            legacy: "GET /api/diretor/dashboard?scope=current",
            overview: "GET /api/diretor/overview?scope=current",
            academic: "GET /api/diretor/academic?scope=current",
            offer: "GET /api/diretor/offer-territories?scope=current",
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const paths = [
    "/api/diretor/dashboard?scope=current",
    "/api/diretor/overview?scope=current",
    "/api/diretor/academic?scope=current",
    "/api/diretor/offer-territories?scope=current",
    "/api/diretor/priorities?scope=current",
  ];

  const results = [];
  for (const path of paths) {
    const r = await timeGet(`${base}${path}`, cookie);
    results.push({ path, ...r });
  }
  console.log(JSON.stringify({ ok: true, base, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
