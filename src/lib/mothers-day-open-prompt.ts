/** Campanha Dia das Mães (slug — igual ao banco / APIs). */
export const MOTHERS_DAY_CAMPAIGN_SLUG = "dia-das-maes-2026";

/**
 * Quando o usuário vem da home (cadastro ou login), pedimos para abrir o modal da campanha no painel.
 * Valor armazenado = slug da campanha (para conferência no cliente).
 */
export const LOCAL_STORAGE_OPEN_CAMPAIGN_AFTER_AUTH = "igh-open-marketing-campaign-after-auth";

export function scheduleOpenMothersCampaignModalAfterAuth(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_STORAGE_OPEN_CAMPAIGN_AFTER_AUTH, MOTHERS_DAY_CAMPAIGN_SLUG);
  } catch {
    /* ignore */
  }
}
