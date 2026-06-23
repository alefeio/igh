import "server-only";

import { getStartOfTodayBrazil } from "@/lib/brazil-today";
import { prisma } from "@/lib/prisma";

const DEFAULT_DAILY_LIMIT = 100;

/** Limite diário de envios via Resend (plano gratuito: 100/dia). */
export function getResendDailyEmailLimit(): number {
  const raw = Number(process.env.RESEND_DAILY_EMAIL_LIMIT ?? DEFAULT_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_LIMIT;
}

/** E-mails já enviados hoje (calendário Brasil): transacionais + campanhas. */
export async function countEmailsSentTodayBrazil(): Promise<number> {
  const start = getStartOfTodayBrazil();
  const [transactional, campaigns] = await Promise.all([
    prisma.sentEmail.count({ where: { sentAt: { gte: start } } }),
    prisma.emailCampaignRecipient.count({
      where: {
        status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] },
        sentAt: { gte: start },
      },
    }),
  ]);
  return transactional + campaigns;
}

export async function getResendDailyEmailRemaining(): Promise<number> {
  const used = await countEmailsSentTodayBrazil();
  return Math.max(0, getResendDailyEmailLimit() - used);
}

export async function hasResendDailyEmailQuota(amount = 1): Promise<boolean> {
  const remaining = await getResendDailyEmailRemaining();
  return remaining >= amount;
}
