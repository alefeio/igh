/**
 * Seed dos Modelos oficiais da Gerência (contrato, distrato, termo de doação).
 * Aplica no banco IGH e no banco INAC.
 * Executar: npm run seed:modelos
 */
import "./load-env";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { applyDocumentTemplatesV1Seed } from "./seeds/apply-document-templates-v1";

function hostHint(url: string): string {
  try {
    const u = new URL(url.replace(/^postgresql:/i, "http:"));
    return `${u.host}${u.pathname}`;
  } catch {
    return "(url inválida)";
  }
}

function ighUrl(): string {
  const u =
    process.env.APP_DIRECT_URL?.trim() ||
    process.env.APP_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!u) {
    throw new Error("Banco IGH: defina APP_DIRECT_URL ou APP_DATABASE_URL.");
  }
  return u;
}

function resolveInacUrl(): string | null {
  const url = process.env.APP_DIRECT_URL_INAC?.trim();
  if (!url) return null;
  if (process.env.APP_DATABASE_URL && url === process.env.APP_DATABASE_URL) {
    throw new Error("APP_DIRECT_URL_INAC é igual a APP_DATABASE_URL — recusando para não misturar com o IGH.");
  }
  if (process.env.APP_DIRECT_URL && url === process.env.APP_DIRECT_URL) {
    throw new Error("APP_DIRECT_URL_INAC é igual a APP_DIRECT_URL — recusando para não misturar com o IGH.");
  }
  return url;
}

async function seedOnUrl(label: string, connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 2 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    console.log(`=== Modelos: ${label} (${hostHint(connectionString)}) ===`);
    await applyDocumentTemplatesV1Seed(db);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

export async function seedDocumentTemplatesIghAndInac(opts?: { requireInac?: boolean }) {
  await seedOnUrl("IGH", ighUrl());
  const inac = resolveInacUrl();
  if (!inac) {
    if (opts?.requireInac) {
      throw new Error("Banco INAC: APP_DIRECT_URL_INAC não está definido no .env.");
    }
    console.warn("INAC omitido: APP_DIRECT_URL_INAC ausente.");
    return;
  }
  await seedOnUrl("INAC", inac);
}

async function main() {
  await seedDocumentTemplatesIghAndInac({ requireInac: true });
}

const isDirect = process.argv[1]?.includes("seed-document-templates");
if (isDirect) {
  main().catch(async (e) => {
    console.error("Erro no seed de modelos:", e);
    process.exit(1);
  });
}
