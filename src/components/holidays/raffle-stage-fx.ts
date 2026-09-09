"use client";

/**
 * Sons do sorteio a partir de arquivos em /public/sounds/raffle/.
 * HTMLAudioElement costuma ser mais confiável que Web Audio puro em mobile.
 */

const TICK_SRC = "/sounds/raffle/tick.wav";
const SUSPENSE_SRC = "/sounds/raffle/suspense.wav";
const CELEBRATION_SRC = "/sounds/raffle/celebration.wav";

let unlocked = false;
let tickAudio: HTMLAudioElement | null = null;
let suspenseAudio: HTMLAudioElement | null = null;
let celebrationAudio: HTMLAudioElement | null = null;

function makeAudio(src: string, opts?: { loop?: boolean; volume?: number }): HTMLAudioElement {
  const a = new Audio(src);
  a.preload = "auto";
  a.loop = opts?.loop ?? false;
  a.volume = opts?.volume ?? 1;
  return a;
}

function ensureAudio() {
  if (typeof window === "undefined") return;
  if (!tickAudio) tickAudio = makeAudio(TICK_SRC, { volume: 0.9 });
  if (!suspenseAudio) suspenseAudio = makeAudio(SUSPENSE_SRC, { loop: true, volume: 0.55 });
  if (!celebrationAudio) celebrationAudio = makeAudio(CELEBRATION_SRC, { volume: 1 });
}

async function safePlay(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (err) {
    console.warn("[raffle-audio] play blocked or failed:", err);
  }
}

/** Precisa ser chamado no clique do botão (gesto do usuário). */
export async function unlockRaffleAudio() {
  if (typeof window === "undefined") return;
  ensureAudio();
  if (unlocked) return;

  // Desbloqueia a política de autoplay tocando e pausando imediatamente.
  const candidates = [tickAudio, suspenseAudio, celebrationAudio].filter(Boolean) as HTMLAudioElement[];
  for (const a of candidates) {
    try {
      a.muted = true;
      a.volume = 0;
      await a.play();
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    } catch {
      /* ignore — tentaremos de novo no play real */
    }
  }
  if (tickAudio) tickAudio.volume = 0.9;
  if (suspenseAudio) suspenseAudio.volume = 0.55;
  if (celebrationAudio) celebrationAudio.volume = 1;
  unlocked = true;
}

export function playCountdownTick(_secondsLeft?: number) {
  ensureAudio();
  if (!tickAudio) return;
  // Clone curto evita cortar o tick anterior se ainda estiver tocando.
  const clone = tickAudio.cloneNode(true) as HTMLAudioElement;
  clone.volume = 0.9 + Math.min(0.1, ((_secondsLeft ?? 3) === 1 ? 0.1 : 0));
  void clone.play().catch((err) => console.warn("[raffle-audio] tick failed:", err));
}

export function startSuspenseBed(): () => void {
  ensureAudio();
  const audio = suspenseAudio;
  if (!audio) return () => {};

  void safePlay(audio);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
  };
}

export function playCelebrationBurst() {
  ensureAudio();
  try {
    suspenseAudio?.pause();
    if (suspenseAudio) suspenseAudio.currentTime = 0;
  } catch {
    /* ignore */
  }
  void safePlay(celebrationAudio);
}

export function stopAllRaffleAudio() {
  for (const a of [tickAudio, suspenseAudio, celebrationAudio]) {
    if (!a) continue;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}
