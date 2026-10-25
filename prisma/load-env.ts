/**
 * Carrega `.env` e `.env.local` antes de importar `src/lib/prisma.ts` nos scripts `tsx`.
 * O Next.js injeta env em dev/build; `tsx prisma/*.ts` não — sem isto, DATABASE_URL fica vazio.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const root = process.cwd();
const env = resolve(root, ".env");
const local = resolve(root, ".env.local");
const devDatabaseLocked = process.env.DATABASE_ENV === "development";
const lockedAppUrl = process.env.APP_DATABASE_URL;
const lockedDirectUrl = process.env.APP_DIRECT_URL;
if (existsSync(env)) config({ path: env });
if (existsSync(local)) config({ path: local, override: true });
if (devDatabaseLocked) {
  if (lockedAppUrl) process.env.APP_DATABASE_URL = lockedAppUrl;
  if (lockedDirectUrl) process.env.APP_DIRECT_URL = lockedDirectUrl;
  for (const key of [
    "APP_DIRECT_URL_INAC",
    "DIRECT_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "PRISMA_DATABASE_URL",
    "SHADOW_DATABASE_URL",
  ]) {
    delete process.env[key];
  }
}
