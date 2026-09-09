"use client";

import { Expand, Gift, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  playCelebrationBurst,
  playCountdownTick,
  startSuspenseBed,
  stopAllRaffleAudio,
  unlockRaffleAudio,
} from "@/components/holidays/raffle-stage-fx";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

export type RaffleWinnerItem = {
  drawId: string;
  ticketId: string;
  number: number;
  participantName: string;
  drawnAt: string;
  eligibleCount: number;
};

export type RaffleItem = {
  id: string;
  title: string;
  prize: string | null;
  description: string | null;
  order: number;
  status: string;
  allowRepeatWinner: boolean;
  winner: RaffleWinnerItem | null;
};

const COUNTDOWN_FROM = 5;

async function parseApiJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return null;
  }
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] ?? value;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type StagePhase = "countdown" | "reveal";

type StageState = {
  raffle: RaffleItem;
  winner: RaffleWinnerItem | null;
  phase: StagePhase;
  celebrate: boolean;
};

/** Confetes em canvas sobre o overlay de revelação. */
function ConfettiLayer({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#F59E0B", "#EF4444", "#22C55E", "#3B82F6", "#EC4899", "#FDE68A", "#FFFFFF"];
    type Particle = {
      x: number;
      y: number;
      w: number;
      h: number;
      vx: number;
      vy: number;
      rot: number;
      vr: number;
      color: string;
      life: number;
    };

    const particles: Particle[] = [];
    const spawnBurst = (cx: number, cy: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 14;
        particles.push({
          x: cx,
          y: cy,
          w: 6 + Math.random() * 8,
          h: 4 + Math.random() * 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          color: colors[Math.floor(Math.random() * colors.length)]!,
          life: 1,
        });
      }
    };

    spawnBurst(window.innerWidth * 0.5, window.innerHeight * 0.35, 140);
    spawnBurst(window.innerWidth * 0.2, window.innerHeight * 0.2, 70);
    spawnBurst(window.innerWidth * 0.8, window.innerHeight * 0.2, 70);

    let frames = 0;
    const tick = () => {
      if (!running) return;
      frames += 1;
      if (frames % 18 === 0 && frames < 120) {
        spawnBurst(Math.random() * window.innerWidth, window.innerHeight * 0.15, 28);
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.vy += 0.22;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.006;
        if (p.life <= 0 || p.y > window.innerHeight + 40) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (particles.length > 0 || frames < 160) {
        raf = window.requestAnimationFrame(tick);
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1]"
    />
  );
}

function StageOverlay({
  eventName,
  raffleTitle,
  prize,
  winner,
  phase,
  countdown,
  celebrate,
  onClose,
}: {
  eventName: string;
  raffleTitle: string;
  prize: string | null;
  winner: RaffleWinnerItem | null;
  phase: StagePhase;
  countdown: number | null;
  celebrate: boolean;
  onClose: () => void;
}) {
  const isCountdown = phase === "countdown";

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden p-6 text-center text-white ${
        isCountdown
          ? "bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a]"
          : "bg-gradient-to-b from-[#0b3d2e] via-[var(--igh-secondary)] to-[#0a1f18]"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={isCountdown ? "Contagem do sorteio" : "Resultado do sorteio"}
    >
      <ConfettiLayer active={celebrate && phase === "reveal"} />

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar tela cheia"
        className="absolute right-4 top-4 z-[2] rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="relative z-[2] flex max-w-5xl flex-col items-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">{eventName}</p>
        <h2 className="mt-3 text-2xl font-bold sm:text-4xl">{raffleTitle}</h2>
        {prize?.trim() ? <p className="mt-2 text-lg text-white/80 sm:text-2xl">{prize}</p> : null}

        {isCountdown ? (
          <>
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/90">
              Preparando o sorteio…
            </p>
            <p
              key={countdown}
              className="mt-4 animate-pulse text-[28vw] font-extrabold leading-none tracking-tighter text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,0.45)] sm:text-[18vw]"
            >
              {countdown ?? "…"}
            </p>
            <p className="mt-4 text-sm text-white/50 sm:text-base">Que rufem os tambores…</p>
          </>
        ) : winner ? (
          <>
            <p className="mt-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/90">
              <Sparkles className="h-4 w-4" aria-hidden />
              Número sorteado
              <Sparkles className="h-4 w-4" aria-hidden />
            </p>
            <p className="mt-2 animate-[pulse_1.2s_ease-in-out_2] text-[22vw] font-extrabold leading-none tracking-tighter text-amber-300 drop-shadow-[0_0_50px_rgba(251,191,36,0.55)] sm:text-[16vw]">
              {winner.number}
            </p>
            <p className="mt-6 flex items-center gap-3 text-2xl font-bold sm:text-4xl">
              <Sparkles className="h-7 w-7 shrink-0 text-amber-300" />
              {winner.participantName}
            </p>
            <p className="mt-4 text-xs text-white/50 sm:text-sm">
              Sorteado entre {winner.eligibleCount}{" "}
              {winner.eligibleCount === 1 ? "número elegível" : "números elegíveis"}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function RaffleDrawPanel({
  holidayId,
  occurrenceDate,
  eventName,
  raffles,
  eligibleCount,
  onChanged,
}: {
  holidayId: string;
  occurrenceDate: string;
  eventName: string;
  raffles: RaffleItem[];
  eligibleCount: number;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [stage, setStage] = useState<StageState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  async function runCountdownSequence() {
    const stopBed = startSuspenseBed();
    try {
      for (let n = COUNTDOWN_FROM; n >= 1; n--) {
        if (abortRef.current) return;
        setCountdown(n);
        playCountdownTick(n);
        await sleep(1000);
      }
      setCountdown(0);
    } finally {
      stopBed();
    }
  }

  async function draw(raffle: RaffleItem, redraw: boolean) {
    if (drawingId) return;
    if (redraw && !window.confirm(`Sortear novamente "${raffle.title}"? O ganhador atual será arquivado.`)) {
      return;
    }

    abortRef.current = false;
    await unlockRaffleAudio();
    setDrawingId(raffle.id);
    setCountdown(COUNTDOWN_FROM);
    setStage({ raffle, winner: null, phase: "countdown", celebrate: false });

    try {
      const [apiOutcome] = await Promise.all([
        (async () => {
          const res = await fetch(`/api/holidays/${holidayId}/raffles/${raffle.id}/draw`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ redraw }),
          });
          const json = await parseApiJson<{ winner: RaffleWinnerItem; redrawn: boolean }>(res);
          return { res, json };
        })(),
        runCountdownSequence(),
      ]);

      const { res, json } = apiOutcome;
      if (!res.ok || !json || !json.ok) {
        setStage(null);
        setCountdown(null);
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível sortear.");
        return;
      }

      // Mesmo se fechar o overlay no meio, o sorteio já foi gravado — atualiza a lista.
      if (abortRef.current) {
        onChanged();
        return;
      }

      playCelebrationBurst();
      setStage({
        raffle,
        winner: json.data.winner,
        phase: "reveal",
        celebrate: true,
      });
      toast.push(
        "success",
        `Número ${json.data.winner.number} — ${firstName(json.data.winner.participantName)}!`,
      );
      onChanged();
    } finally {
      setDrawingId(null);
    }
  }

  async function showExistingWinner(raffle: RaffleItem) {
    if (!raffle.winner) return;
    await unlockRaffleAudio();
    setCountdown(null);
    setStage({
      raffle,
      winner: raffle.winner,
      phase: "reveal",
      celebrate: true,
    });
    playCelebrationBurst();
  }

  function closeStage() {
    abortRef.current = true;
    stopAllRaffleAudio();
    setStage(null);
    setCountdown(null);
  }

  if (raffles.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Nenhum sorteio cadastrado para {occurrenceDate}. Edite o evento em /holidays para adicionar.
      </p>
    );
  }

  return (
    <>
      <ul className="list-none space-y-3 pl-0">
        {raffles.map((raffle) => {
          const cancelled = raffle.status === "CANCELLED";
          const busy = drawingId === raffle.id;
          return (
            <li
              key={raffle.id}
              className={`rounded-xl border p-4 ${
                cancelled
                  ? "border-[var(--card-border)] bg-[var(--igh-surface)]/40 opacity-70"
                  : raffle.winner
                    ? "border-amber-200 bg-amber-50/60 dark:bg-amber-900/10"
                    : "border-[var(--card-border)] bg-[var(--card-bg)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-[var(--text-primary)]">
                    <Gift className="h-4 w-4 text-[var(--igh-accent)]" aria-hidden />
                    {raffle.title}
                    {cancelled ? <Badge tone="red">Cancelado</Badge> : null}
                    {raffle.allowRepeatWinner ? (
                      <Badge tone="zinc">Permite ganhador repetido</Badge>
                    ) : null}
                  </p>
                  {raffle.prize?.trim() ? (
                    <p className="mt-0.5 text-sm text-[var(--igh-primary)]">{raffle.prize}</p>
                  ) : null}
                  {raffle.description?.trim() ? (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{raffle.description}</p>
                  ) : null}
                  {raffle.winner ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <Trophy className="h-4 w-4" aria-hidden />
                      Número {raffle.winner.number} — {raffle.winner.participantName}
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        (entre {raffle.winner.eligibleCount})
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {eligibleCount === 0
                        ? "Aguardando confirmações de presença."
                        : `${eligibleCount} ${eligibleCount === 1 ? "número elegível" : "números elegíveis"}.`}
                    </p>
                  )}
                </div>

                {cancelled ? null : (
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {raffle.winner ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-[44px] w-full sm:w-auto"
                          onClick={() => void showExistingWinner(raffle)}
                        >
                          <Expand className="mr-1.5 h-4 w-4" aria-hidden />
                          Mostrar em tela cheia
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy || drawingId != null}
                          className="min-h-[44px] w-full text-amber-700 sm:w-auto"
                          onClick={() => void draw(raffle, true)}
                        >
                          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                          {busy ? "Sorteando…" : "Sortear novamente"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        disabled={busy || drawingId != null}
                        className="min-h-[48px] w-full sm:w-auto"
                        onClick={() => void draw(raffle, false)}
                      >
                        <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
                        {busy ? "Sorteando…" : "Realizar sorteio"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {stage ? (
        <StageOverlay
          eventName={eventName}
          raffleTitle={stage.raffle.title}
          prize={stage.raffle.prize}
          winner={stage.winner}
          phase={stage.phase}
          countdown={countdown}
          celebrate={stage.celebrate}
          onClose={closeStage}
        />
      ) : null}
    </>
  );
}
