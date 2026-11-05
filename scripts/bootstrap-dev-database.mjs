/**
 * Bootstrap do Postgres Docker vazio: schema atual + histórico antigo marcado como aplicado.
 * Não altera migrations históricas e não toca em banco remoto.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEV_DATABASE,
  DEV_PASSWORD,
  DEV_USER,
  buildDevDatabaseUrl,
  devDatabaseEnv,
  printDevDatabaseConfirmation,
} from "./dev-database-lib.mjs";

const root = process.cwd();
const url = buildDevDatabaseUrl();
printDevDatabaseConfirmation(url);
const env = devDatabaseEnv(url);

function run(command, options = {}) {
  const result = spawnSync(command, {
    cwd: root,
    env: options.env ?? env,
    shell: true,
    encoding: "utf8",
    input: options.input,
    stdio: options.input != null ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
  });
  return result;
}

function requireOk(result, label) {
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    console.error(detail);
    console.error(`Falha em: ${label}`);
    process.exit(result.status || 1);
  }
}

const docker = run("docker info", { env: process.env });
requireOk(docker, "docker info");

requireOk(run("docker compose -f docker-compose.dev.yml up -d", { env: process.env }), "db:dev:up");

let healthy = false;
for (let i = 0; i < 30; i += 1) {
  const inspect = run('docker inspect --format "{{.State.Health.Status}}" igh-dev-postgres', {
    env: process.env,
  });
  if ((inspect.stdout || "").trim() === "healthy") {
    healthy = true;
    break;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
}
if (!healthy) {
  console.error("O container igh-dev-postgres não ficou saudável.");
  process.exit(1);
}

function psql(sql) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${DEV_PASSWORD}`,
      "-i",
      "igh-dev-postgres",
      "psql",
      "-U",
      DEV_USER,
      "-d",
      DEV_DATABASE,
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      sql,
    ],
    { encoding: "utf8" },
  );
  return result;
}

function psqlFile(filePath) {
  const sql = readFileSync(filePath);
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${DEV_PASSWORD}`,
      "-i",
      "igh-dev-postgres",
      "psql",
      "-U",
      DEV_USER,
      "-d",
      DEV_DATABASE,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql },
  );
  return result;
}

const status = run("npx prisma migrate status");
const statusText = `${status.stdout ?? ""}\n${status.stderr ?? ""}`;
if (status.status === 0 && /up to date/i.test(statusText)) {
  console.log("Banco DEV já está inicializado. Nenhuma recriação foi feita.");
  process.exit(0);
}

const tableCount = psql(
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'",
);
if (tableCount.status !== 0) {
  console.error(tableCount.stderr || tableCount.stdout);
  process.exit(1);
}
const existingTables = Number((tableCount.stdout || "0").trim());
if (existingTables > 0) {
  console.error(
    "O banco local já tem tabelas e não está em dia com o Prisma. Nada foi apagado. Recrie só o volume local com DEV_DB_RESET_CONFIRM=yes npm run db:dev:reset e rode o bootstrap de novo.",
  );
  process.exit(1);
}

const diff = run(
  "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
);
requireOk(diff, "prisma migrate diff");
const script = diff.stdout || "";
if (!script.trim()) {
  console.error("O baseline SQL veio vazio.");
  process.exit(1);
}
if (/prisma\.io|neon\.tech|amazonaws\.com/i.test(script)) {
  console.error("O SQL do baseline contém host remoto. Abortado.");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "igh-dev-baseline-"));
const baselinePath = join(dir, "baseline.sql");
writeFileSync(baselinePath, script);
const applied = psqlFile(baselinePath);
rmSync(dir, { recursive: true, force: true });
requireOk(applied, "aplicar baseline");

const integrity = psqlFile(join(root, "scripts", "dev-database-integrity.sql"));
requireOk(integrity, "restrição do fórum");

const migrationsDir = join(root, "prisma", "migrations");
const names = readdirSync(migrationsDir)
  .filter((name) => {
    const folder = join(migrationsDir, name);
    return statSync(folder).isDirectory() && statSync(join(folder, "migration.sql")).isFile();
  })
  .sort();

for (const name of names) {
  const resolved = run(`npx prisma migrate resolve --applied ${name}`);
  requireOk(resolved, `migrate resolve ${name}`);
}

const finalStatus = run("npx prisma migrate status");
const finalText = `${finalStatus.stdout ?? ""}\n${finalStatus.stderr ?? ""}`;
process.stdout.write(finalText);
if (finalStatus.status !== 0 || !/up to date/i.test(finalText)) {
  console.error("prisma migrate status não ficou em dia.");
  process.exit(1);
}

const users = psql('SELECT count(*) FROM "User"');
requireOk(users, "contar usuários");
console.log(`Usuários no DEV: ${(users.stdout || "").trim()}`);
console.log("Bootstrap DEV concluído. Crie o Master fictício em http://localhost:3000/setup");
