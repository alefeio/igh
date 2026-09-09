"use client";

import { Gift, Plus, RefreshCw, Trash2, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import type { RaffleItem } from "@/components/holidays/RaffleDrawPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

async function parseApiJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return null;
  }
}

/** Ocorrências oferecidas no seletor: a data exata, ou dia/mês no ano atual e no seguinte. */
function occurrenceOptions(date: string, recurring: boolean): string[] {
  const ymd = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return [];
  if (!recurring) return [ymd];
  const mmdd = ymd.slice(5);
  const year = new Date().getFullYear();
  return [`${year}-${mmdd}`, `${year + 1}-${mmdd}`];
}

/**
 * Cadastro dos sorteios de uma ocorrência do evento.
 * Os números só são emitidos no check-in, então aqui só definimos os prêmios.
 */
export function HolidayEventRafflesEditor({
  holidayId,
  date,
  recurring,
}: {
  holidayId: string;
  date: string;
  recurring: boolean;
}) {
  const toast = useToast();
  const options = useMemo(() => occurrenceOptions(date, recurring), [date, recurring]);
  const [occurrenceDate, setOccurrenceDate] = useState(options[0] ?? "");
  const [raffles, setRaffles] = useState<RaffleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [allowRepeatWinner, setAllowRepeatWinner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    if (options.length > 0 && !options.includes(occurrenceDate)) setOccurrenceDate(options[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join("|")]);

  const load = useCallback(async () => {
    if (!occurrenceDate) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/holidays/${holidayId}/raffles?occurrenceDate=${occurrenceDate}`,
      );
      const json = await parseApiJson<{ raffles: RaffleItem[] }>(res);
      setRaffles(res.ok && json?.ok ? json.data.raffles : []);
    } finally {
      setLoading(false);
    }
  }, [holidayId, occurrenceDate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRaffle() {
    const trimmed = title.trim();
    if (trimmed.length < 2) {
      toast.push("error", "Informe o nome do sorteio.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/holidays/${holidayId}/raffles`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occurrenceDate,
          title: trimmed,
          prize: prize.trim() || null,
          allowRepeatWinner,
        }),
      });
      const json = await parseApiJson<{ raffle: unknown }>(res);
      if (!res.ok || !json || !json.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível criar o sorteio.");
        return;
      }
      setTitle("");
      setPrize("");
      setAllowRepeatWinner(false);
      toast.push("success", "Sorteio cadastrado.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeRaffle(raffle: RaffleItem) {
    const hadWinner = Boolean(raffle.winner);
    const msg = hadWinner
      ? `Excluir o sorteio "${raffle.title}"? Ele já foi realizado — o histórico do ganhador também será removido.`
      : `Excluir o sorteio "${raffle.title}"?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(`/api/holidays/${holidayId}/raffles/${raffle.id}`, { method: "DELETE" });
    const json = await parseApiJson<{ deleted: boolean }>(res);
    if (!res.ok || !json || !json.ok) {
      toast.push("error", json && !json.ok ? json.error.message : "Não foi possível excluir.");
      return;
    }
    toast.push("success", "Sorteio excluído.");
    await load();
  }

  async function removeAllRaffles() {
    if (raffles.length === 0) return;
    const drawn = raffles.filter((r) => r.winner).length;
    const msg =
      drawn > 0
        ? `Excluir todos os ${raffles.length} sorteios desta data? ${drawn} já ${drawn === 1 ? "foi realizado" : "foram realizados"} e o histórico dos ganhadores será removido.`
        : `Excluir todos os ${raffles.length} sorteios desta data?`;
    if (!window.confirm(msg)) return;
    setDeletingAll(true);
    try {
      const res = await fetch(
        `/api/holidays/${holidayId}/raffles?occurrenceDate=${occurrenceDate}`,
        { method: "DELETE" },
      );
      const json = await parseApiJson<{ deleted: number }>(res);
      if (!res.ok || !json || !json.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível excluir.");
        return;
      }
      toast.push("success", `${json.data.deleted} sorteio(s) excluído(s).`);
      await load();
    } finally {
      setDeletingAll(false);
    }
  }

  async function cancelRaffle(raffle: RaffleItem) {
    const res = await fetch(`/api/holidays/${holidayId}/raffles/${raffle.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: raffle.status === "CANCELLED" ? "PENDING" : "CANCELLED" }),
    });
    const json = await parseApiJson<{ raffle: unknown }>(res);
    if (!res.ok || !json || !json.ok) {
      toast.push("error", json && !json.ok ? json.error.message : "Não foi possível atualizar.");
      return;
    }
    await load();
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        Defina a data do evento para cadastrar sorteios.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <Gift className="h-4 w-4 text-[var(--igh-accent)]" aria-hidden />
          Sorteios deste evento
        </p>
        <div className="flex items-center gap-2">
          {options.length > 1 ? (
            <select
              className="theme-input h-9 rounded-md border px-2 text-xs outline-none focus:border-[var(--igh-primary)]"
              value={occurrenceDate}
              onChange={(e) => setOccurrenceDate(e.target.value)}
            >
              {options.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Os números são gerados no dia, no check-in, apenas para quem tiver presença confirmada.
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">Carregando sorteios…</p>
      ) : raffles.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">Nenhum sorteio cadastrado nesta data.</p>
      ) : (
        <>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              className="text-red-600 hover:text-red-700"
              disabled={deletingAll}
              onClick={() => void removeAllRaffles()}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              {deletingAll ? "Excluindo…" : "Excluir todos"}
            </Button>
          </div>
          <ul className="mt-2 list-none space-y-2 pl-0">
            {raffles.map((raffle) => (
              <li
                key={raffle.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] p-2.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    {raffle.title}
                    {raffle.status === "CANCELLED" ? <Badge tone="red">Cancelado</Badge> : null}
                    {raffle.allowRepeatWinner ? <Badge tone="zinc">Repete ganhador</Badge> : null}
                  </p>
                  {raffle.prize?.trim() ? (
                    <p className="text-xs text-[var(--text-muted)]">{raffle.prize}</p>
                  ) : null}
                  {raffle.winner ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <Trophy className="h-3.5 w-3.5" aria-hidden />
                      Nº {raffle.winner.number} — {raffle.winner.participantName}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button type="button" variant="secondary" onClick={() => void cancelRaffle(raffle)}>
                    {raffle.status === "CANCELLED" ? "Reativar" : "Cancelar"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-red-600 hover:text-red-700"
                    title="Excluir sorteio"
                    onClick={() => void removeRaffle(raffle)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nome do sorteio (ex.: Sorteio principal)"
        />
        <Input
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
          placeholder="Prêmio (opcional)"
        />
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={allowRepeatWinner}
          onChange={(e) => setAllowRepeatWinner(e.target.checked)}
        />
        Permitir que alguém que já ganhou outro sorteio desta data seja sorteado de novo
      </label>
      <Button type="button" className="mt-2" onClick={() => void addRaffle()} disabled={saving}>
        <Plus className="mr-1.5 h-4 w-4" aria-hidden />
        {saving ? "Salvando…" : "Adicionar sorteio"}
      </Button>
    </div>
  );
}
