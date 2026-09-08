"use client";

import { Expand, Gift, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { useState } from "react";

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

/** Modo palco: número grande e nome do ganhador, para projetar no evento. */
function StageOverlay({
  eventName,
  raffleTitle,
  prize,
  winner,
  onClose,
}: {
  eventName: string;
  raffleTitle: string;
  prize: string | null;
  winner: RaffleWinnerItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--igh-secondary)] p-6 text-center text-white">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar tela cheia"
        className="absolute right-4 top-4 rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">{eventName}</p>
      <h2 className="mt-3 text-2xl font-bold sm:text-4xl">{raffleTitle}</h2>
      {prize?.trim() ? <p className="mt-2 text-lg text-white/80 sm:text-2xl">{prize}</p> : null}
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
        Número sorteado
      </p>
      <p className="mt-2 text-[22vw] font-extrabold leading-none tracking-tighter sm:text-[16vw]">
        {winner.number}
      </p>
      <p className="mt-6 flex items-center gap-3 text-2xl font-bold sm:text-4xl">
        <Sparkles className="h-7 w-7 text-[var(--igh-accent)]" />
        {winner.participantName}
      </p>
      <p className="mt-4 text-xs text-white/50">
        Sorteado entre {winner.eligibleCount}{" "}
        {winner.eligibleCount === 1 ? "número elegível" : "números elegíveis"}
      </p>
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
  const [stage, setStage] = useState<{ raffle: RaffleItem; winner: RaffleWinnerItem } | null>(null);

  async function draw(raffle: RaffleItem, redraw: boolean) {
    if (drawingId) return;
    if (redraw && !window.confirm(`Sortear novamente "${raffle.title}"? O ganhador atual será arquivado.`)) {
      return;
    }
    setDrawingId(raffle.id);
    try {
      const res = await fetch(`/api/holidays/${holidayId}/raffles/${raffle.id}/draw`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redraw }),
      });
      const json = await parseApiJson<{ winner: RaffleWinnerItem; redrawn: boolean }>(res);
      if (!res.ok || !json || !json.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível sortear.");
        return;
      }
      setStage({ raffle, winner: json.data.winner });
      toast.push(
        "success",
        `Número ${json.data.winner.number} — ${firstName(json.data.winner.participantName)}!`,
      );
      onChanged();
    } finally {
      setDrawingId(null);
    }
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
                          onClick={() => setStage({ raffle, winner: raffle.winner! })}
                        >
                          <Expand className="mr-1.5 h-4 w-4" aria-hidden />
                          Mostrar em tela cheia
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
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
                        disabled={busy}
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
          onClose={() => setStage(null)}
        />
      ) : null}
    </>
  );
}
