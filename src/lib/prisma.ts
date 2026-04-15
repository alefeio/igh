import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";

declare global {
  // Turbopack/HMR e múltiplos entrypoints podem reavaliar o módulo: um único client + pool no globalThis.
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaPgAdapter: PrismaPg | undefined;
}

function getConnectionString(): string {
  let u =
    process.env.APP_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.PRISMA_DATABASE_URL;
  if (!u) {
    throw new Error(
      "URL de banco não configurada (APP_DATABASE_URL / DATABASE_URL / POSTGRES_URL / PRISMA_DATABASE_URL)"
    );
  }
  // Prisma Postgres (db.prisma.io): forçar pooled para serverless (Vercel injeta URL sem pooled)
  if (u.includes("db.prisma.io") && !u.includes("pooled=true")) {
    u += u.includes("?") ? "&pooled=true" : "?pooled=true";
  }
  return u;
}

/** Usuários do tipo prisma_migration têm pouquíssimas conexões (só migração). O app deve usar URL “pooled” / app. */
function warnIfMigrationOnlyUser(connectionString: string) {
  try {
    const url = new URL(connectionString.replace(/^postgresql:/i, "http:"));
    const user = decodeURIComponent(url.username || "");
    if (/migration/i.test(user)) {
      console.warn(
        "[prisma] O usuário na URL parece ser só para migração (ex.: prisma_migration). " +
          "Configure APP_DATABASE_URL ou DATABASE_URL com o usuário da aplicação (Neon: host com -pooler ou string “pooled”). " +
          "Do contrário o Postgres recusa conexões e o login falha com UNAUTHENTICATED."
      );
    }
  } catch {
    /* ignore */
  }
}

function poolConfigFromEnv(): PoolConfig {
  const connectionString = getConnectionString();
  warnIfMigrationOnlyUser(connectionString);

  const parsed = parseInt(process.env.PRISMA_PG_POOL_MAX ?? "", 10);
  const fallback = process.env.NODE_ENV === "production" ? 10 : 5;
  const max = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;

  return {
    connectionString,
    max,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
  };
}

function createAdapter() {
  return new PrismaPg(poolConfigFromEnv());
}

const g = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaPgAdapter?: PrismaPg;
};

export const prisma =
  g.prisma ??
  (g.prisma = new PrismaClient({
    adapter: (g.prismaPgAdapter ??= createAdapter()),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }));
