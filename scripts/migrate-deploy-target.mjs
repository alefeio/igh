import fs from "node:fs";
import { spawnSync } from "node:child_process";

function parseEnvFile(path) {
  const raw = fs.readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const target = process.argv[2]; // "IGH" | "INAC"
if (target !== "IGH" && target !== "INAC") {
  console.error('Uso: node scripts/migrate-deploy-target.mjs IGH|INAC');
  process.exit(1);
}

const fileEnv = parseEnvFile(".env");
const url =
  target === "INAC" ? fileEnv.APP_DIRECT_URL_INAC : fileEnv.APP_DIRECT_URL;

if (!url || !url.startsWith("postgres")) {
  console.error(`URL direta ausente no .env para ${target}`);
  process.exit(1);
}

const userPrefix = (url.match(/^postgres(?:ql)?:\/\/([^:]+):/) || [])[1]?.slice(0, 8);
console.log(`Migrating ${target} (user ${userPrefix}...)`);

const env = {
  ...process.env,
  APP_DIRECT_URL: url,
  DIRECT_URL: url,
  // Evita o Prisma preferir pooled/runtime do IGH por engano
  APP_DATABASE_URL: url,
  DATABASE_URL: url,
  POSTGRES_URL: url,
  PRISMA_DATABASE_URL: url,
};

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env,
  encoding: "utf8",
  shell: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
