"use client";

/** Efeitos de áudio do sorteio (Web Audio API — sem arquivos externos). */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

/** Chamar no clique do botão para liberar áudio nos navegadores. */
export function unlockRaffleAudio() {
  getCtx();
}

function tone(
  ctx: AudioContext,
  opts: {
    freq: number;
    start: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    endFreq?: number;
  },
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, opts.start);
  if (opts.endFreq != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), opts.start + opts.duration);
  }
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, opts.start);
  g.gain.exponentialRampToValueAtTime(peak, opts.start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(opts.start);
  osc.stop(opts.start + opts.duration + 0.02);
}

/** Tick de suspense a cada segundo da contagem (tom sobe conforme aproxima do zero). */
export function playCountdownTick(secondsLeft: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const freq = 220 + (5 - Math.min(5, Math.max(1, secondsLeft))) * 90;
  tone(ctx, { freq, start: t, duration: 0.18, type: "triangle", gain: 0.22 });
  tone(ctx, { freq: freq * 1.5, start: t, duration: 0.12, type: "sine", gain: 0.08 });
}

/** Rolo de suspense contínuo durante a contagem. */
export function startSuspenseBed(): () => void {
  const ctx = getCtx();
  if (!ctx) return () => {};

  const master = ctx.createGain();
  master.gain.value = 0.07;
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 55;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 180;
  osc.connect(filter);
  filter.connect(master);
  osc.start();

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 4;
  lfoGain.gain.value = 40;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const now = ctx.currentTime;
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    try {
      osc.stop(now + 0.3);
      lfo.stop(now + 0.3);
    } catch {
      /* already stopped */
    }
  };
}

/** Explosão de vitória + “aplausos” sintetizados. */
export function playCelebrationBurst() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;

  // Acorde triunfal
  for (const freq of [523.25, 659.25, 783.99, 1046.5]) {
    tone(ctx, { freq, start: t0, duration: 0.9, type: "triangle", gain: 0.12 });
  }
  tone(ctx, { freq: 261.63, start: t0, duration: 1.1, type: "sine", gain: 0.1, endFreq: 523.25 });

  // Ruído ritmado ≈ aplausos / gritos
  const bufferSize = Math.floor(ctx.sampleRate * 2.4);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 1.4));
    const clap = Math.random() * 2 - 1;
    const pulse = 0.55 + 0.45 * Math.sin((i / ctx.sampleRate) * Math.PI * 14);
    data[i] = clap * env * pulse * 0.55;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800;
  band.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.value = 0.35;
  noise.connect(band);
  band.connect(g);
  g.connect(ctx.destination);
  noise.start(t0);
}
