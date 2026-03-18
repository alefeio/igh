/**
 * Resend limita a API (ex.: 5 requisições/segundo). Espaçamos as chamadas para não ser bloqueado.
 * Em serverless, o estado é por instância; dentro de um mesmo lote/cron isso já evita rajadas.
 */
const MIN_INTERVAL_MS = Number(process.env.RESEND_MIN_INTERVAL_MS ?? 260);

let lastCallStart = 0;

export function isResendRateLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("muitas solicitações") ||
    m.includes("limite de taxa")
  );
}

export async function throttleBeforeResendCall(): Promise<void> {
  const gap = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastCallStart));
  if (gap > 0) {
    await new Promise((r) => setTimeout(r, gap));
  }
  lastCallStart = Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
