/** Parser da planilha de Prestação de Contas → lançamentos de saída. */

import type { FinancialPaymentMethod } from "@/generated/prisma/client";

export type PrestacaoImportRow = {
  description: string;
  entryDate: string; // YYYY-MM-DD
  amountCents: number;
  paymentMethod: FinancialPaymentMethod;
  supplier: string | null;
  responsibleName: string;
  notes: string | null;
  sheetName: string;
  rowNumber: number;
};

export type PrestacaoImportParseResult = {
  rows: PrestacaoImportRow[];
  skipped: Array<{ sheetName: string; rowNumber: number; reason: string }>;
  defaultResponsibleName: string | null;
};

const HEADER_MARKERS = ["DESCRIÇÃO", "DESCRICAO", "DATA", "VALORES", "FORMA DE PAGAMENTO"] as const;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

/** Excel serial date → YYYY-MM-DD (sistema 1900 do Excel). */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  // Dias desde 1970-01-01; 25569 = 1970-01-01 no calendário serial do Excel.
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86_400_000);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseSpreadsheetDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToIsoDate(value);
  }
  const text = cellText(value);
  if (!text) return null;
  const br = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return null;
}

export function parseSpreadsheetAmountToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }
  const text = cellText(value);
  if (!text) return null;
  // BR: 1.234,56
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(text) || /^\d+,\d{2}$/.test(text)) {
    const n = Number(text.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  }
  // US / plain
  const n = Number(text.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function mapPaymentMethodFromSpreadsheet(raw: string): FinancialPaymentMethod {
  const t = fold(raw);
  if (!t) return "OUTRO";
  if (t.includes("PIX")) return "PIX";
  if (t.includes("DINHEIRO") || t.includes("ESPECIE") || t === "ESPÉCIE") return "DINHEIRO";
  if (t.includes("TRANSFER")) return "TRANSFERENCIA";
  if (t.includes("BOLETO")) return "BOLETO";
  if (t.includes("CHEQUE")) return "CHEQUE";
  if (t.includes("CARTAO") || t.includes("CREDITO") || t.includes("DEBITO") || t.includes("CRÉDITO")) {
    return "CARTAO";
  }
  return "OUTRO";
}

type ColMap = {
  description: number;
  date: number;
  amount: number;
  payment: number;
  local: number;
  destination: number;
  notes: number;
};

function detectHeader(row: unknown[]): ColMap | null {
  const folded = row.map((c) => fold(cellText(c)));
  const description = folded.findIndex((c) => c === "DESCRICAO" || c.startsWith("DESCRICAO"));
  const date = folded.findIndex((c) => c === "DATA");
  const amount = folded.findIndex((c) => c === "VALORES" || c === "VALOR");
  const payment = folded.findIndex((c) => c.includes("FORMA") && c.includes("PAGAMENTO"));
  if (description < 0 || date < 0 || amount < 0) return null;
  // Sanity: header should look like the prestação template
  const joined = folded.join("|");
  if (!HEADER_MARKERS.some((m) => joined.includes(fold(m)))) return null;
  return {
    description,
    date,
    amount,
    payment: payment >= 0 ? payment : -1,
    local: folded.findIndex((c) => c === "LOCAL" || c.includes("FORNECEDOR") || c.includes("ESTABELEC")),
    destination: folded.findIndex(
      (c) => c.includes("SAIDAS") || c.includes("DESTINO") || c.includes("GALPAO"),
    ),
    notes: folded.findIndex((c) => c.startsWith("OBSERV")),
  };
}

function guessDefaultResponsible(rows: unknown[][]): string | null {
  for (const row of rows.slice(0, 12)) {
    for (const cell of row) {
      const t = cellText(cell);
      if (/^Adm\.?\s+/i.test(t) || /^Administra/i.test(t)) return t.slice(0, 120);
    }
  }
  return null;
}

/**
 * Converte matriz de células (sheet_to_json header:1) em linhas de importação.
 */
export function parsePrestacaoSheetMatrix(
  sheetName: string,
  matrix: unknown[][],
  options?: { defaultResponsibleName?: string | null },
): PrestacaoImportParseResult {
  const skipped: PrestacaoImportParseResult["skipped"] = [];
  const rows: PrestacaoImportRow[] = [];
  const defaultResponsibleName =
    options?.defaultResponsibleName?.trim() || guessDefaultResponsible(matrix) || "Prestação de contas";

  let headerIdx = -1;
  let cols: ColMap | null = null;
  for (let i = 0; i < matrix.length; i++) {
    const detected = detectHeader(matrix[i] ?? []);
    if (detected) {
      headerIdx = i;
      cols = detected;
      break;
    }
  }
  if (!cols || headerIdx < 0) {
    return { rows, skipped, defaultResponsibleName };
  }

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const rowNumber = i + 1;
    const description = cellText(row[cols.description]);
    const amountRaw = row[cols.amount];
    const dateRaw = row[cols.date];

    // Linha totalmente vazia
    if (!description && cellText(amountRaw) === "" && cellText(dateRaw) === "") continue;

    if (!description || description.length < 3) {
      skipped.push({ sheetName, rowNumber, reason: "Descrição ausente ou muito curta" });
      continue;
    }

    const amountCents = parseSpreadsheetAmountToCents(amountRaw);
    if (amountCents == null) {
      skipped.push({ sheetName, rowNumber, reason: "Valor ausente ou inválido" });
      continue;
    }

    const entryDate = parseSpreadsheetDate(dateRaw);
    if (!entryDate) {
      skipped.push({ sheetName, rowNumber, reason: "Data ausente ou inválida" });
      continue;
    }

    const paymentMethod =
      cols.payment >= 0
        ? mapPaymentMethodFromSpreadsheet(cellText(row[cols.payment]))
        : ("OUTRO" as const);
    const supplier = cols.local >= 0 ? cellText(row[cols.local]) || null : null;
    const destination = cols.destination >= 0 ? cellText(row[cols.destination]) : "";
    const obs = cols.notes >= 0 ? cellText(row[cols.notes]) : "";
    const notesParts = [destination ? `Destino: ${destination}` : null, obs || null].filter(Boolean);
    const responsibleName = (destination || defaultResponsibleName).slice(0, 120);

    rows.push({
      description: description.slice(0, 500),
      entryDate,
      amountCents,
      paymentMethod,
      supplier: supplier ? supplier.slice(0, 200) : null,
      responsibleName,
      notes: notesParts.length ? notesParts.join(" · ").slice(0, 1000) : null,
      sheetName,
      rowNumber,
    });
  }

  return { rows, skipped, defaultResponsibleName };
}

export type PrestacaoWorkbookSheet = { name: string; matrix: unknown[][] };

export function parsePrestacaoWorkbook(sheets: PrestacaoWorkbookSheet[]): PrestacaoImportParseResult {
  const rows: PrestacaoImportRow[] = [];
  const skipped: PrestacaoImportParseResult["skipped"] = [];
  let defaultResponsibleName: string | null = null;

  for (const sheet of sheets) {
    // Capa tipicamente sem grade de lançamentos
    if (fold(sheet.name) === "CAPA") continue;
    const parsed = parsePrestacaoSheetMatrix(sheet.name, sheet.matrix);
    if (!defaultResponsibleName && parsed.defaultResponsibleName) {
      defaultResponsibleName = parsed.defaultResponsibleName;
    }
    rows.push(...parsed.rows);
    skipped.push(...parsed.skipped);
  }

  return {
    rows,
    skipped,
    defaultResponsibleName: defaultResponsibleName ?? "Prestação de contas",
  };
}
