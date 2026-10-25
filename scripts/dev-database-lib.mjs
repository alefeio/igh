/**
 * Destino fixo do Postgres Docker de desenvolvimento.
 * Não lê .env. Recusa host remoto, em especial db.prisma.io.
 */

export const DEV_USER = "igh_dev";
export const DEV_PASSWORD = "igh_dev_local_only";
export const DEV_DATABASE = "igh_dev";
export const DEV_HOST = "127.0.0.1";
export const DEV_PORT = process.env.DEV_DB_PORT?.trim() || "5432";

export const BLOCKED_HOST_MARKERS = [
  "prisma.io",
  "neon.tech",
  "vercel-storage.com",
  "amazonaws.com",
  "supabase.co",
  "render.com",
];

export const DATABASE_ENV_KEYS = [
  "APP_DATABASE_URL",
  "APP_DIRECT_URL",
  "APP_DIRECT_URL_INAC",
  "DIRECT_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "PRISMA_DATABASE_URL",
  "SHADOW_DATABASE_URL",
];

export function failDevDatabase(message) {
  console.error(`Banco DEV recusado: ${message}`);
  process.exit(1);
}

export function assertDevDatabaseTarget(host, database) {
  const normalized = String(host || "").toLowerCase().split(":")[0];
  if (!normalized) failDevDatabase("host ausente.");
  if (BLOCKED_HOST_MARKERS.some((marker) => normalized.includes(marker))) {
    failDevDatabase(`host remoto bloqueado (${normalized}).`);
  }
  if (normalized !== "127.0.0.1" && normalized !== "localhost") {
    failDevDatabase(`somente 127.0.0.1 ou localhost são aceitos (recebido: ${normalized}).`);
  }
  if (database !== DEV_DATABASE) {
    failDevDatabase(`database esperado ${DEV_DATABASE} (recebido: ${database || "(vazio)"}).`);
  }
}

export function buildDevDatabaseUrl() {
  const url = new URL("postgresql://127.0.0.1");
  url.username = DEV_USER;
  url.password = DEV_PASSWORD;
  url.hostname = DEV_HOST;
  url.port = DEV_PORT;
  url.pathname = `/${DEV_DATABASE}`;
  assertDevDatabaseTarget(url.hostname, url.pathname.replace(/^\//, ""));
  return url.toString();
}

export function printDevDatabaseConfirmation(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const database = parsed.pathname.replace(/^\//, "");
  assertDevDatabaseTarget(host, database);
  const production = BLOCKED_HOST_MARKERS.some((marker) => host.includes(marker));
  console.log("Database environment: DEVELOPMENT");
  console.log(`Host: ${host}`);
  console.log(`Database: ${database}`);
  console.log("Remote host: NO");
  console.log(`Production host detected: ${production ? "YES" : "NO"}`);
  if (production) failDevDatabase("confirmação detectou host de produção.");
}

export function devDatabaseEnv(url) {
  const env = { ...process.env };
  for (const key of DATABASE_ENV_KEYS) delete env[key];
  env.APP_DATABASE_URL = url;
  env.APP_DIRECT_URL = url;
  env.DATABASE_ENV = "development";
  return env;
}
