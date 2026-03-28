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
if (existsSync(env)) config({ path: env });
if (existsSync(local)) config({ path: local, override: true });
