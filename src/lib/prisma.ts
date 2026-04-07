import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // Em dev (Turbopack/HMR), o módulo pode ser avaliado múltiplas vezes.
  // Guardamos client + adapter no globalThis para evitar abrir pools/conexões repetidamente.
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaPgAdapter: PrismaPg | undefined;
}

function getConnectionString(): string {
  let u =
    process.env.POSTGRES_URL ??
    process.env.PRISMA_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!u) {
    throw new Error("URL de banco não configurada (POSTGRES_URL / PRISMA_DATABASE_URL / DATABASE_URL)");
  }
  // Prisma Postgres (db.prisma.io): forçar pooled para serverless (Vercel injeta URL sem pooled)
  if (u.includes("db.prisma.io") && !u.includes("pooled=true")) {
    u += u.includes("?") ? "&pooled=true" : "?pooled=true";
  }
  return u;
}

function createAdapter() {
  return new PrismaPg({ connectionString: getConnectionString() });
}

const g = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaPgAdapter?: PrismaPg;
};

export const prisma =
  g.prisma ??
  new PrismaClient({
    adapter: (g.prismaPgAdapter ??= createAdapter()),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  g.prisma = prisma;
}
