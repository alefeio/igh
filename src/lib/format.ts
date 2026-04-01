/** Fuso usado na plataforma para exibir instantes armazenados em UTC no banco. */
export const BRAZIL_TIMEZONE = "America/Sao_Paulo";

/**
 * Data/hora em horário de Brasília (para timestamps UTC do Prisma/ISO).
 * `timeZone` fixo evita diferença entre servidor e cliente para o mesmo instante.
 */
export function formatDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
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
