/**
 * Formata data/hora de forma determinística (sem locale) para evitar
 * diferença entre servidor e cliente (hydration mismatch).
 */
export function formatDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/**
 * Formata apenas a data (dd/mm/yyyy) sem deslocamento de fuso.
 * Use para datas “só dia” (ex.: startDate, sessionDate, birthDate) que vêm em UTC ou como YYYY-MM-DD.
 */
export function formatDateOnly(isoOrDate: string | Date | null | undefined): string {
  if (isoOrDate == null) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (typeof isoOrDate === "string") {
    const datePart = isoOrDate.trim().split("T")[0];
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [y, m, d] = datePart.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    const d = new Date(isoOrDate);
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  const d = isoOrDate;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
