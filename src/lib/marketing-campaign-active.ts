export type MarketingCampaignWindowFields = {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Janela de tempo em que a campanha aceita envio/participação (mesma regra da API active). */
export function isMarketingCampaignActiveInWindow(c: MarketingCampaignWindowFields): boolean {
  if (!c.isActive) return false;
  const now = new Date();
  if (c.startsAt && now < c.startsAt) return false;
  if (c.endsAt && now > c.endsAt) return false;
  return true;
}

export function marketingCampaignVisibilityLabel(c: MarketingCampaignWindowFields): {
  tone: "green" | "zinc" | "amber";
  text: string;
} {
  if (!c.isActive) return { tone: "zinc", text: "Desativada" };
  if (isMarketingCampaignActiveInWindow(c)) {
    return { tone: "green", text: "Visível (site e dashboard)" };
  }
  return { tone: "amber", text: "Ativa, fora do período de datas" };
}
