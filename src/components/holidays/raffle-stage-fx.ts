"use client";

/**
 * Sons do sorteio.
 * Rufar: /public/sounds/tambores.mp3
 * Comemoração: /public/sounds/aplausos.mp3 (se existir) ou aplausos.wav
 */

const DRUMROLL_SRC = "/sounds/tambores.mp3";
const CELEBRATION_CANDIDATES = ["/sounds/aplausos.mp3", "/sounds/aplausos.wav"];

let unlocked = false;
let drumrollAudio: HTMLAudioElement | null = null;
let celebrationAudio: HTMLAudioElement | null = null;
let celebrationResolved = false;

function makeAudio(src: string, opts?: { volume?: number }): HTMLAudioElement {
  const a = new Audio(src);
  a.preload = "auto";
  a.loop = false;
  a.volume = opts?.volume ?? 1;
  return a;
}

async function resolveCelebrationSrc(): Promise<string> {
  for (const src of CELEBRATION_CANDIDATES) {
    try {
      const res = await fetch(src, { method: "HEAD", cache: "no-store" });
      if (res.ok) return src;
    } catch {
      /* tenta o próximo */
    }
  }
  return CELEBRATION_CANDIDATES[CELEBRATION_CANDIDATES.length - 1]!;
}

async function ensureAudio() {
  if (typeof window === "undefined") return;
  if (!drumrollAudio) drumrollAudio = makeAudio(DRUMROLL_SRC, { volume: 1 });
  if (!celebrationAudio || !celebrationResolved) {
    const src = await resolveCelebrationSrc();
    celebrationAudio = makeAudio(src, { volume: 1 });
    celebrationResolved = true;
  }
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
  await ensureAudio();
  if (unlocked) return;

  const candidates = [drumrollAudio, celebrationAudio].filter(Boolean) as HTMLAudioElement[];
  for (const a of candidates) {
    try {
      a.muted = true;
      a.volume = 0;
      await a.play();
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    } catch {
      /* ignore */
    }
  }
  if (drumrollAudio) drumrollAudio.volume = 1;
  if (celebrationAudio) celebrationAudio.volume = 1;
  unlocked = true;
}

/** Mantido por compatibilidade — o rufar de tambores cobre o suspense. */
export function playCountdownTick(_secondsLeft?: number) {
  /* sem tick separado: o MP3 de tambores é o efeito principal */
}

export function startSuspenseBed(): () => void {
  let stopped = false;
  let audio: HTMLAudioElement | null = null;

  void (async () => {
    await ensureAudio();
    if (stopped) return;
    audio = drumrollAudio;
    await safePlay(audio);
  })();

  return () => {
    stopped = true;
    try {
      audio?.pause();
      if (audio) audio.currentTime = 0;
      drumrollAudio?.pause();
      if (drumrollAudio) drumrollAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
  };
}

export function playCelebrationBurst() {
  void (async () => {
    await ensureAudio();
    try {
      drumrollAudio?.pause();
      if (drumrollAudio) drumrollAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    await safePlay(celebrationAudio);
  })();
}

export function stopAllRaffleAudio() {
  for (const a of [drumrollAudio, celebrationAudio]) {
    if (!a) continue;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}
