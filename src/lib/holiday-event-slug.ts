import { prisma } from "@/lib/prisma";

/** Converte um texto livre em slug de URL (sem acentos, apenas a-z0-9 e hífen). */
export function slugifyHolidayEventName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120)
    .replace(/-$/, "");
}

/**
 * Gera um slug único para o evento. Retorna null quando não há base utilizável
 * (evento sem nome), caso em que a página pública cai no fallback por id.
 */
export async function ensureUniqueHolidaySlug(
  desired: string | null | undefined,
  excludeHolidayId?: string,
): Promise<string | null> {
  const base = slugifyHolidayEventName(desired?.trim() ?? "");
  if (!base) return null;

  let candidate = base;
  for (let n = 2; n < 200; n += 1) {
    const existing = await prisma.holiday.findFirst({
      where: { slug: candidate, ...(excludeHolidayId ? { id: { not: excludeHolidayId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Caminho da página pública do evento; usa o slug quando existe, senão o id. */
export function holidayEventPublicPath(
  holiday: { id: string; slug?: string | null },
  occurrenceDate?: string | null,
): string {
  const key = holiday.slug?.trim() || holiday.id;
  const suffix = occurrenceDate ? `?data=${occurrenceDate}` : "";
  return `/eventos/${encodeURIComponent(key)}${suffix}`;
}
