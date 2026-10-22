"use client";

import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";

export function CoordinatorOccurrenceButton({
  enrollmentId,
  studentName,
  onSaved,
}: {
  enrollmentId: string;
  studentName: string;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const body = text.trim();
    if (body.length < 2) {
      toast.push("error", "Escreva a ocorrência.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/coordenacao/alunos/${enrollmentId}/ocorrencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ entry: { id: string } }> | null;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível registrar a ocorrência.");
        return;
      }
      setText("");
      setOpen(false);
      toast.push("success", "Ocorrência registrada no histórico.");
      onSaved?.();
    } catch {
      toast.push("error", "Falha de rede ao registrar a ocorrência.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Registrar ocorrência
      </Button>
      <Modal open={open} title={`Ocorrência de ${studentName}`} size="small" onClose={() => setOpen(false)}>
        <p className="text-sm text-[var(--text-muted)]">
          O texto entra no histórico do aluno. A matrícula permanece como está.
        </p>
        <label className="mt-3 flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
          Ocorrência
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            rows={4}
            className="theme-input min-h-[96px] w-full rounded-md border px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando…" : "Registrar"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
