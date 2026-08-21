import { authErrorResponse } from "@/lib/api-auth-guard";
import { createAuditLog } from "@/lib/audit";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import {
  parsePrestacaoWorkbook,
  type PrestacaoImportRow,
} from "@/lib/financeiro-prestacao-import";
import { resolveInitialPaymentStatus } from "@/lib/financeiro-payment";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function workbookToSheets(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];
    return { name, matrix };
  });
}

async function existingSaidaKeys(candidates: PrestacaoImportRow[]) {
  if (candidates.length === 0) return new Set<string>();
  const amounts = [...new Set(candidates.map((r) => r.amountCents))];
  const dates = [...new Set(candidates.map((r) => new Date(`${r.entryDate}T00:00:00.000Z`)))];
  const found = await prisma.financialEntry.findMany({
    where: {
      deletedAt: null,
      kind: "SAIDA",
      amountCents: { in: amounts },
      entryDate: { in: dates },
    },
    select: { description: true, amountCents: true, entryDate: true },
  });
  return new Set(
    found.map(
      (e) =>
        `${e.entryDate.toISOString().slice(0, 10)}|${e.amountCents}|${e.description.trim().toLowerCase()}`,
    ),
  );
}

function rowKey(row: PrestacaoImportRow): string {
  return `${row.entryDate}|${row.amountCents}|${row.description.trim().toLowerCase()}`;
}

/** Importa planilha de prestação de contas como saídas financeiras. */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonErr("VALIDATION_ERROR", "Envie o arquivo da planilha.", 400);

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonErr("VALIDATION_ERROR", "Selecione um arquivo .xlsx ou .xls.", 400);
  }

  const name = file.name || "prestacao.xlsx";
  if (!/\.(xlsx|xls)$/i.test(name)) {
    return jsonErr("VALIDATION_ERROR", "Formato inválido. Use .xlsx ou .xls.", 400);
  }
  if (file.size > 8 * 1024 * 1024) {
    return jsonErr("VALIDATION_ERROR", "Arquivo muito grande (máx. 8 MB).", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let sheets;
  try {
    sheets = workbookToSheets(buffer);
  } catch (e) {
    console.error("[financeiro/importar-prestacao] xlsx", e);
    return jsonErr("VALIDATION_ERROR", "Não foi possível ler a planilha.", 400);
  }

  const parsed = parsePrestacaoWorkbook(sheets);
  if (parsed.rows.length === 0) {
    return jsonErr(
      "VALIDATION_ERROR",
      "Nenhuma linha válida encontrada. Use a planilha de Prestação de Contas (DESCRIÇÃO, DATA, Valores…).",
      400,
    );
  }

  const existing = await existingSaidaKeys(parsed.rows);
  const toCreate: PrestacaoImportRow[] = [];
  const duplicates: PrestacaoImportRow[] = [];
  for (const row of parsed.rows) {
    if (existing.has(rowKey(row))) duplicates.push(row);
    else toCreate.push(row);
  }

  let created = 0;
  if (toCreate.length > 0) {
    await prisma.$transaction(
      toCreate.map((row) => {
        const initial = resolveInitialPaymentStatus({
          dueDate: new Date(`${row.entryDate}T00:00:00.000Z`),
          // Prestação registra despesas já realizadas.
          alreadyPaid: true,
        });
        return prisma.financialEntry.create({
          data: {
            kind: "SAIDA",
            description: row.description,
            amountCents: row.amountCents,
            entryDate: new Date(`${row.entryDate}T00:00:00.000Z`),
            paymentStatus: initial.paymentStatus,
            paidAt: initial.paidAt,
            paymentMethod: row.paymentMethod,
            supplier: row.supplier,
            responsibleName: row.responsibleName,
            notes: row.notes,
            createdByUserId: actor.id,
            expenseNature: "VARIAVEL",
          },
        });
      }),
    );
    created = toCreate.length;
  }

  await createAuditLog({
    entityType: "FinancialEntry",
    entityId: actor.id,
    action: "PRESTACAO_IMPORT",
    diff: {
      fileName: name,
      created,
      skippedInvalid: parsed.skipped.length,
      skippedDuplicates: duplicates.length,
      defaultResponsibleName: parsed.defaultResponsibleName,
    },
    performedByUserId: actor.id,
  });

  return jsonOk({
    created,
    skippedInvalid: parsed.skipped,
    skippedDuplicates: duplicates.map((r) => ({
      sheetName: r.sheetName,
      rowNumber: r.rowNumber,
      description: r.description,
      entryDate: r.entryDate,
      amountCents: r.amountCents,
    })),
    preview: toCreate.slice(0, 5).map((r) => ({
      description: r.description,
      entryDate: r.entryDate,
      amountCents: r.amountCents,
      paymentMethod: r.paymentMethod,
      supplier: r.supplier,
      responsibleName: r.responsibleName,
    })),
  });
}
