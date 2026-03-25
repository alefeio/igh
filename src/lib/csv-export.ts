/** Escapa célula para CSV (separador `;`, compatível com Excel em pt-BR). */
export function csvEscapeCell(value: string | null | undefined): string {
  const v = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (/[";]/.test(v) || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function rowsToCsvSemicolon(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvEscapeCell).join(";"), ...rows.map((r) => r.map(csvEscapeCell).join(";"))];
  return `\ufeff${lines.join("\r\n")}`;
}
