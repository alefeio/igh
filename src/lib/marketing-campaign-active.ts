/** Janela de tempo em que a campanha aceita envio/participação (mesma regra da API active). */
export function isMarketingCampaignActiveInWindow(c: {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}): boolean {
  if (!c.isActive) return false;
  const now = new Date();
  if (c.startsAt && now < c.startsAt) return false;
  if (c.endsAt && now > c.endsAt) return false;
  return true;
}
