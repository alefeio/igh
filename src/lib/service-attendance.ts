export const SERVICE_CHANNELS = ["PRESENCIAL", "WHATSAPP", "TELEFONE", "EMAIL", "SITE"] as const;

export type ServiceChannelValue = (typeof SERVICE_CHANNELS)[number];

export const SERVICE_CHANNEL_LABEL: Record<ServiceChannelValue, string> = {
  PRESENCIAL: "Presencial no polo",
  WHATSAPP: "WhatsApp",
  TELEFONE: "Telefone",
  EMAIL: "E-mail",
  SITE: "Site",
};

export const SERVICE_SCORE_FACES = [
  { score: 1, emoji: "😞", label: "Muito insatisfeito" },
  { score: 2, emoji: "🙁", label: "Insatisfeito" },
  { score: 3, emoji: "😐", label: "Neutro" },
  { score: 4, emoji: "🙂", label: "Satisfeito" },
  { score: 5, emoji: "😄", label: "Muito satisfeito" },
] as const;

/** Máscara brasileira com DDD. 10 dígitos: fixo. 11: celular. */
export function formatBrazilPhoneMask(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}
