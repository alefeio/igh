/**
 * Executa um comando apontando o Prisma somente para o Postgres Docker local.
 * Ignora URLs de .env. Recusa db.prisma.io e qualquer host que não seja local.
 */
import { spawn } from "node:child_process";

const DEV_USER = "igh_dev";
const DEV_PASSWORD = "igh_dev_local_only";
const DEV_DATABASE = "igh_dev";
const DEV_HOST = "127.0.0.1";
const DEV_PORT = process.env.DEV_DB_PORT?.trim() || "5432";

const BLOCKED_HOST_MARKERS = ["prisma.io", "neon.tech", "vercel-storage.com", "aws.amazon.com", "supabase.co", "render.com"];

function fail(message) {
  console.error(`Banco DEV recusado: ${message}`);
  process.exit(1);
}

export function assertDevDatabaseTarget(host, database) {
  const normalized = String(host || "").toLowerCase().split(":")[0];
  if (!normalized) fail("host ausente.");
  if (BLOCKED_HOST_MARKERS.some((marker) => normalized.includes(marker))) {
    fail(`host remoto bloqueado (${normalized}).`);
  }
  if (normalized !== "127.0.0.1" && normalized !== "localhost") {
    fail(`somente 127.0.0.1 ou localhost são aceitos (recebido: ${normalized}).`);
  }
  if (database !== DEV_DATABASE) {
    fail(`database esperado ${DEV_DATABASE} (recebido: ${database || "(vazio)"}).`);
  }
}

function buildDevUrl() {
  const url = new URL("postgresql://127.0.0.1");
  url.username = DEV_USER;
  url.password = DEV_PASSWORD;
  url.hostname = DEV_HOST;
  url.port = DEV_PORT;
  url.pathname = `/${DEV_DATABASE}`;
  assertDevDatabaseTarget(url.hostname, url.pathname.replace(/^\//, ""));
  if (url.hostname.includes("prisma.io")) fail("db.prisma.io não é destino DEV.");
  return url.toString();
}

function printConfirmation(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const database = parsed.pathname.replace(/^\//, "");
  const production = BLOCKED_HOST_MARKERS.some((marker) => host.includes(marker));
  console.log("Database environment: DEVELOPMENT");
  console.log(`Host: ${host}`);
  console.log(`Database: ${database}`);
  console.log(`Production host detected: ${production ? "YES" : "NO"}`);
  if (production) fail("confirmação detectou host de produção.");
}

function devEnv(url) {
  const env = { ...process.env };
  for (const key of [
    "APP_DATABASE_URL",
    "APP_DIRECT_URL",
    "APP_DIRECT_URL_INAC",
    "DIRECT_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "PRISMA_DATABASE_URL",
    "SHADOW_DATABASE_URL",
  ]) {
    delete env[key];
  }
  env.APP_DATABASE_URL = url;
  env.APP_DIRECT_URL = url;
  env.DATABASE_ENV = "development";
  return env;
}

const command = process.argv.slice(2).join(" ").trim();
if (!command) {
  console.error("Uso: node scripts/with-dev-database.mjs <comando>");
  process.exit(2);
}

const url = buildDevUrl();
printConfirmation(url);
const child = spawn(command, {
  env: devEnv(url),
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});
child.on("exit", (code) => process.exit(code ?? 1));
