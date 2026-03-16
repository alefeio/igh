/**
 * Toca um som de notificação curto (dois tons) usando Web Audio API.
 * Não depende de arquivos externos.
 */
export function playNotificationSound(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playTone(523.25, 0, 0.08);
    playTone(659.25, 0.12, 0.12);
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    // Ignorar se o navegador bloquear áudio (ex.: sem interação do usuário)
  }
}
