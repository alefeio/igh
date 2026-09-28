"use client";

import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";
import {
  ENROLLMENT_HISTORY_KIND_LABEL,
  type EnrollmentHistoryKindValue,
} from "@/lib/enrollment-history";

export type EnrollmentHistoryItem = {
  id: string;
  kind: EnrollmentHistoryKindValue;
  body: string;
  createdAt: string;
  authorName: string;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function EnrollmentFollowUp({
  classGroupId,
  enrollmentId,
  studentName,
  history,
  onAdded,
}: {
  classGroupId: string;
  enrollmentId: string;
  studentName: string;
  history: EnrollmentHistoryItem[];
  onAdded: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body = text.trim();
    if (body.length < 2) {
      toast.push("error", "Escreva a informação da busca ativa.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/teacher/class-groups/${classGroupId}/enrollments/${enrollmentId}/history`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      const json = (await res.json().catch(() => null)) as ApiResponse<{ entry: EnrollmentHistoryItem }> | null;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível registrar.");
        return;
      }
      setText("");
      setOpen(false);
      toast.push("success", "Informação adicionada ao histórico.");
      onAdded();
    } catch {
      toast.push("error", "Falha de rede ao registrar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">Histórico</p>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Adicionar informação
        </Button>
      </div>
      {history.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Nenhum registro ainda.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {history.map((entry) => (
            <li key={entry.id} className="text-xs text-[var(--text-primary)]">
              <p className="text-[var(--text-muted)]">
                {formatWhen(entry.createdAt)} · {ENROLLMENT_HISTORY_KIND_LABEL[entry.kind] ?? entry.kind} ·{" "}
                {entry.authorName}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{entry.body}</p>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} title={`Histórico de ${studentName}`} size="small" onClose={() => setOpen(false)}>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Busca ativa ou outra informação
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={4}
            className="theme-input min-h-[88px] w-full rounded-md border px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando…" : "Adicionar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
