/** Neutraliza CSV Formula Injection (valores que o Excel interpreta como fórmula). */
export function neutralizeCsvFormula(value: string): string {
  const first = value.charAt(0);
  if (first === "=" || first === "+" || first === "-" || first === "@" || first === "\t" || first === "\r") {
    return `'${value}`;
  }
  return value;
}

/** Escapa célula para CSV (separador `;`, compatível com Excel em pt-BR). */
export function csvEscapeCell(value: string | null | undefined): string {
  const v = neutralizeCsvFormula(
    String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n"),
  );
  if (/[";]/.test(v) || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function rowsToCsvSemicolon(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvEscapeCell).join(";"), ...rows.map((r) => r.map(csvEscapeCell).join(";"))];
  return `\ufeff${lines.join("\r\n")}`;
}

export function safeReportFilename(type: string, format: "json" | "csv" | "pdf" | "xlsx"): string {
  const t = type.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "report";
  return `diretor-${t}.${format}`;
}
