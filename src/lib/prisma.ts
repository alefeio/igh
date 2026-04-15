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

function detectEnvSource(): "APP_DATABASE_URL" | "DATABASE_URL" | "POSTGRES_URL" | "PRISMA_DATABASE_URL" | "none" {
  if (process.env.APP_DATABASE_URL) return "APP_DATABASE_URL";
  if (process.env.DATABASE_URL) return "DATABASE_URL";
  if (process.env.POSTGRES_URL) return "POSTGRES_URL";
  if (process.env.PRISMA_DATABASE_URL) return "PRISMA_DATABASE_URL";
  return "none";
}

function safeConnInfo(connectionString: string): { user: string; host: string; db: string; flags: string[] } {
  try {
    const u = new URL(connectionString.replace(/^postgresql:/i, "http:"));
    const userRaw = decodeURIComponent(u.username || "");
    const host = u.host || "";
    const db = (u.pathname || "").replace(/^\//, "");
    const flags: string[] = [];
    if (/migration/i.test(userRaw)) flags.push("migration_user");
    if (u.searchParams.get("pooled") === "true") flags.push("pooled=true");
    const user = userRaw ? `${userRaw.slice(0, 3)}***` : "(empty)";
    return { user, host, db, flags };
  } catch {
    return { user: "(unparseable)", host: "(unparseable)", db: "(unparseable)", flags: ["unparseable"] };
  }
}

export function getPrismaConnectionDebugInfo(): {
  source: "APP_DATABASE_URL" | "DATABASE_URL" | "POSTGRES_URL" | "PRISMA_DATABASE_URL" | "none";
  host: string;
  db: string;
  userMasked: string;
  flags: string[];
} {
  const source = detectEnvSource();
  const connectionString = getConnectionString();
  const info = safeConnInfo(connectionString);
  return { source, host: info.host, db: info.db, userMasked: info.user, flags: info.flags };
}

function poolConfigFromEnv(): PoolConfig {
  const source = detectEnvSource();
  const connectionString = getConnectionString();
  warnIfMigrationOnlyUser(connectionString);
  // Log seguro (sem segredo) para diagnosticar qual env está sendo usada em produção (Vercel).
  if (!process.env.PRISMA_ENV_LOGGED) {
    const info = safeConnInfo(connectionString);
    console.warn(
      `[prisma] datasource=${source} host=${info.host} db=${info.db} user=${info.user} flags=${info.flags.join(",") || "-"}`
    );
    process.env.PRISMA_ENV_LOGGED = "1";
  }

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
