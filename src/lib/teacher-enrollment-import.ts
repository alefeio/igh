/** Parser e modelo de planilha para importação de pré-matrículas pelo professor. */

import ExcelJS from "exceljs";
import { parseSpreadsheetDate } from "@/lib/financeiro-prestacao-import";

export const TEACHER_ENROLLMENT_IMPORT_HEADERS = [
  "nome",
  "data_nascimento",
  "telefone",
  "email",
  "cpf",
  "responsavel_nome",
  "responsavel_cpf",
  "responsavel_telefone",
  "responsavel_parentesco",
  "responsavel_rg",
] as const;

export type TeacherEnrollmentImportHeader = (typeof TEACHER_ENROLLMENT_IMPORT_HEADERS)[number];

export type TeacherEnrollmentImportRow = {
  rowNumber: number;
  name: string;
  birthDate: string; // YYYY-MM-DD
  phone: string;
  email: string | null;
  cpf: string | null;
  guardianName: string | null;
  guardianCpf: string | null;
  guardianPhone: string | null;
  guardianRelationship: string | null;
  guardianRg: string | null;
};

export type TeacherEnrollmentImportParseResult = {
  rows: TeacherEnrollmentImportRow[];
  errors: Array<{ row: number; message: string }>;
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).trim();
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function ageFromIso(birthDate: string): number | null {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function isValidCpf(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  if (rev !== parseInt(d[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  return rev === parseInt(d[10], 10);
}

function headerIndexMap(headerCells: string[]): Map<TeacherEnrollmentImportHeader, number> {
  const map = new Map<TeacherEnrollmentImportHeader, number>();
  headerCells.forEach((raw, idx) => {
    const key = fold(raw);
    for (const h of TEACHER_ENROLLMENT_IMPORT_HEADERS) {
      if (key === h || key === fold(h.replace(/_/g, " "))) {
        map.set(h, idx);
      }
    }
  });
  return map;
}

function validateBusinessRow(
  partial: Omit<TeacherEnrollmentImportRow, "rowNumber"> & { rowNumber: number },
): string | null {
  if (partial.name.trim().length < 2) return "Nome obrigatório (mín. 2 caracteres).";
  if (!partial.birthDate) return "Data de nascimento inválida (use AAAA-MM-DD ou dd/mm/aaaa).";
  if (onlyDigits(partial.phone).length < 10) return "Telefone inválido (mín. 10 dígitos).";
  if (partial.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partial.email)) {
    return "E-mail inválido.";
  }

  const age = ageFromIso(partial.birthDate);
  if (age == null) return "Data de nascimento inválida.";

  if (age >= 18) {
    if (!partial.cpf || onlyDigits(partial.cpf).length !== 11) {
      return "CPF obrigatório para maiores de 18 anos.";
    }
    if (!isValidCpf(partial.cpf)) return "CPF do aluno inválido.";
  } else {
    if (partial.cpf && onlyDigits(partial.cpf).length > 0 && !isValidCpf(partial.cpf)) {
      return "CPF do aluno inválido.";
    }
    if (!partial.guardianName || partial.guardianName.trim().length < 2) {
      return "Menor: informe responsavel_nome.";
    }
    if (!partial.guardianCpf || !isValidCpf(partial.guardianCpf)) {
      return "Menor: informe responsavel_cpf válido.";
    }
    if (!partial.guardianPhone || onlyDigits(partial.guardianPhone).length < 10) {
      return "Menor: informe responsavel_telefone.";
    }
    if (!partial.guardianRelationship || partial.guardianRelationship.trim().length < 1) {
      return "Menor: informe responsavel_parentesco.";
    }
  }
  return null;
}

function rowFromCells(
  cells: string[],
  map: Map<TeacherEnrollmentImportHeader, number>,
  rowNumber: number,
): { row?: TeacherEnrollmentImportRow; error?: string } {
  const get = (h: TeacherEnrollmentImportHeader) => {
    const idx = map.get(h);
    if (idx == null) return "";
    return cells[idx] ?? "";
  };

  const birthRaw = get("data_nascimento");
  const birthDate = parseSpreadsheetDate(birthRaw) ?? ( /^\d{4}-\d{2}-\d{2}$/.test(birthRaw) ? birthRaw : null);

  const partial: TeacherEnrollmentImportRow = {
    rowNumber,
    name: get("nome"),
    birthDate: birthDate ?? "",
    phone: onlyDigits(get("telefone")),
    email: (() => {
      const e = get("email").trim().toLowerCase();
      return e || null;
    })(),
    cpf: (() => {
      const c = onlyDigits(get("cpf"));
      return c || null;
    })(),
    guardianName: get("responsavel_nome").trim() || null,
    guardianCpf: (() => {
      const c = onlyDigits(get("responsavel_cpf"));
      return c || null;
    })(),
    guardianPhone: (() => {
      const p = onlyDigits(get("responsavel_telefone"));
      return p || null;
    })(),
    guardianRelationship: get("responsavel_parentesco").trim() || null,
    guardianRg: get("responsavel_rg").trim() || null,
  };

  const err = validateBusinessRow(partial);
  if (err) return { error: err };
  return { row: partial };
}

/** Gera modelo .xlsx com cabeçalhos + linha de exemplo. */
export async function buildTeacherEnrollmentImportTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alunos");
  ws.addRow([...TEACHER_ENROLLMENT_IMPORT_HEADERS]);
  ws.addRow([
    "Maria Silva Exemplo",
    "15/03/2005",
    "91999999999",
    "maria.exemplo@email.com",
    "52998224725",
    "",
    "",
    "",
    "",
    "",
  ]);
  ws.addRow([
    "João Menor Exemplo",
    "10/08/2012",
    "91888888888",
    "",
    "",
    "Ana Responsavel",
    "52998224725",
    "91777777777",
    "Mãe",
    "",
  ]);
  ws.getRow(1).font = { bold: true };
  ws.columns = TEACHER_ENROLLMENT_IMPORT_HEADERS.map(() => ({ width: 22 }));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function parseTeacherEnrollmentImportFile(
  buffer: Buffer,
  fileName: string,
): Promise<TeacherEnrollmentImportParseResult> {
  const lower = fileName.toLowerCase();
  const errors: Array<{ row: number; message: string }> = [];
  const rows: TeacherEnrollmentImportRow[] = [];

  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return { rows: [], errors: [{ row: 0, message: "Arquivo vazio." }] };
    }
    const sep = lines[0].includes(";") ? ";" : ",";
    const headerCells = lines[0].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const map = headerIndexMap(headerCells);
    if (!map.has("nome") || !map.has("data_nascimento") || !map.has("telefone")) {
      return {
        rows: [],
        errors: [{ row: 1, message: "Cabeçalho inválido. Baixe o modelo e use as colunas esperadas." }],
      };
    }
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cells.every((c) => !c)) continue;
      const parsed = rowFromCells(cells, map, i + 1);
      if (parsed.error) errors.push({ row: i + 1, message: parsed.error });
      else if (parsed.row) rows.push(parsed.row);
    }
    return { rows, errors };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ row: 0, message: "Planilha sem abas." }] };
  }

  const headerRow = ws.getRow(1);
  const headerCells: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headerCells[col - 1] = cellText(cell.value);
  });
  const map = headerIndexMap(headerCells);
  if (!map.has("nome") || !map.has("data_nascimento") || !map.has("telefone")) {
    return {
      rows: [],
      errors: [{ row: 1, message: "Cabeçalho inválido. Baixe o modelo e use as colunas esperadas." }],
    };
  }

  const maxCol = Math.max(...[...map.values()], headerCells.length);
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      cells[c - 1] = cellText(row.getCell(c).value);
    }
    if (cells.every((c) => !c)) return;
    const parsed = rowFromCells(cells, map, rowNumber);
    if (parsed.error) errors.push({ row: rowNumber, message: parsed.error });
    else if (parsed.row) rows.push(parsed.row);
  });

  return { rows, errors };
}
