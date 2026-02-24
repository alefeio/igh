import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: PrismaClient | undefined;
}

function createAdapter() {
  const connectionString =
    // Vercel Prisma Postgres / Data Proxy
    process.env.POSTGRES_URL ??
    process.env.PRISMA_DATABASE_URL ??
    // fallback para dev local
    process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("URL de banco não configurada (POSTGRES_URL / PRISMA_DATABASE_URL / DATABASE_URL)");
  }
  return new PrismaPg({ connectionString });
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
