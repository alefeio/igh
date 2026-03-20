import "server-only";

import { prisma } from "@/lib/prisma";

/** Status que passam automaticamente para EM_ANDAMENTO quando startDate <= hoje (calendário Brasil). */
const STATUSES_PROMOTE_TO_EM_ANDAMENTO = [
  "PLANEJADA",
  "ABERTA",
  "EXTERNO",
  "INTERNO",
] as const;

/**
 * Data de hoje (só calendário) em America/Sao_Paulo, representada como UTC midnight daquele Y-M-D
 * — o mesmo formato usado em `parseDateOnly` ao salvar `startDate` / `endDate`.
 */
export function getTodayCalendarDateUtcBrazil(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  if (!y || !m || !d) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Atualiza status de turmas de forma idempotente:
 * - PLANEJADA, ABERTA, EXTERNO, INTERNO com início <= hoje (Brasil) → EM_ANDAMENTO
 * - EM_ANDAMENTO com fim < hoje e sem preventAutoClose → ENCERRADA
 */
export async function applyClassGroupAutomaticStatusUpdates(): Promise<{
  promotedToEmAndamento: number;
  closedEncerrada: number;
}> {
  const today = getTodayCalendarDateUtcBrazil();

  const [promoted, closed] = await prisma.$transaction([
    prisma.classGroup.updateMany({
      where: {
        status: { in: [...STATUSES_PROMOTE_TO_EM_ANDAMENTO] },
        startDate: { lte: today },
      },
      data: { status: "EM_ANDAMENTO" },
    }),
    prisma.classGroup.updateMany({
      where: {
        status: "EM_ANDAMENTO",
        preventAutoClose: false,
        endDate: { lt: today },
      },
      data: { status: "ENCERRADA" },
    }),
  ]);

  return {
    promotedToEmAndamento: promoted.count,
    closedEncerrada: closed.count,
  };
}
