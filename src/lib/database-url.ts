/**
 * URL de conexão PostgreSQL, alinhada com `src/lib/prisma.ts`.
 * Usada por backup/restore (pg_dump/psql) e pelo cliente Prisma.
 */
export function getDatabaseConnectionString(): string {
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
  if (u.includes("db.prisma.io") && !u.includes("pooled=true")) {
    u += u.includes("?") ? "&pooled=true" : "?pooled=true";
  }
  return u;
}
