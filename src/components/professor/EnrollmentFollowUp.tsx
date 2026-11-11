"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuscaAtivaComposer } from "@/components/professor/BuscaAtivaComposer";
import type { MessageContext } from "@/lib/busca-ativa";
import { formatDaysFullPt } from "@/lib/turma-display";

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
  readOnly = false,
}: {
  classGroupId: string;
  enrollmentId: string;
  studentName: string;
  history: EnrollmentHistoryItem[];
  onAdded: () => void;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"free" | "model">("free");
  const [audience, setAudience] = useState<"aluno" | "interno">("aluno");
  const [context, setContext] = useState<MessageContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [contextLoading, setContextLoading] = useState(false);

  async function refreshContext(): Promise<MessageContext | null> {
    try {
      const res = await fetch(`/api/teacher/busca-ativa?classGroupId=${encodeURIComponent(classGroupId)}&enrollmentId=${encodeURIComponent(enrollmentId)}`, { cache: "no-store" });
      const json = await res.json() as ApiResponse<{ enrollments: MessageContext[] }>;
      if (!res.ok || !json.ok || !json.data.enrollments[0]) {
        setContextError(json.ok ? "Não foi possível carregar a matrícula." : json.error.message);
        setContext(null);
        return null;
      }
      setContext(json.data.enrollments[0]); setContextError("");
      return json.data.enrollments[0];
    } catch { setContextError("Falha de rede ao carregar os dados."); setContext(null); return null; }
  }

  useEffect(() => {
    if (!open || mode !== "model") return;
    let active = true;
    setContext(null); setContextLoading(true); setContextError("");
    void fetch(`/api/teacher/busca-ativa?classGroupId=${encodeURIComponent(classGroupId)}&enrollmentId=${encodeURIComponent(enrollmentId)}`, { cache: "no-store" })
      .then(async (res) => ({ res, json: await res.json() as ApiResponse<{ enrollments: MessageContext[] }> }))
      .then(({ res, json }) => { if (!active) return; if (res.ok && json.ok && json.data.enrollments[0]) setContext(json.data.enrollments[0]); else setContextError(json.ok ? "Matrícula indisponível." : json.error.message); })
      .catch(() => { if (active) setContextError("Falha de rede ao carregar os dados."); })
      .finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, [open, mode, classGroupId, enrollmentId]);

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
        {!readOnly ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Adicionar informação
        </Button>
        ) : null}
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
      <Modal open={open} title={`Histórico de ${studentName}`} size="large" onClose={() => setOpen(false)}>
        {mode === "model" ? (context ? <div className="mb-4 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-3 text-sm"><strong>{context.studentName}</strong><p>{context.courseName} · {context.turmaNome}</p><p>{formatDaysFullPt(context.daysOfWeek) || "Dias não informados"} · {context.startTime && context.endTime ? `${context.startTime} às ${context.endTime}` : "Horário não informado"}</p></div> : contextLoading ? <p className="mb-3 text-sm">Carregando contexto…</p> : contextError ? <p role="alert" className="mb-3 text-sm">{contextError}</p> : null) : null}
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Forma de adicionar informação">
          <Button type="button" variant={mode === "free" ? "primary" : "secondary"} onClick={() => setMode("free")}>Escrever livremente</Button>
          <Button type="button" variant={mode === "model" ? "primary" : "secondary"} onClick={() => setMode("model")}>Usar modelo</Button>
        </div>
        {mode === "model" ? <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Destino do modelo">
            <Button type="button" variant={audience === "aluno" ? "primary" : "secondary"} onClick={() => setAudience("aluno")}>Mensagem para o aluno</Button>
            <Button type="button" variant={audience === "interno" ? "primary" : "secondary"} onClick={() => setAudience("interno")}>Registro interno</Button>
            <Link className="rounded-md border px-3 py-2 text-sm" href={`/professor/turmas/${encodeURIComponent(classGroupId)}?aba=busca-ativa&mode=turma`}>Mensagem para a turma ↗</Link>
          </div>
          {contextLoading ? <p>Carregando dados da matrícula…</p> : contextError ? <p role="alert">{contextError}</p> : context ? <BuscaAtivaComposer key={`${context.classGroupId}:${context.enrollmentId}:${audience}`} context={context} audience={audience} refresh={refreshContext} onSaved={() => { setOpen(false); onAdded(); }} /> : null}
        </> : <>
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
        </>}
      </Modal>
    </div>
  );
}
