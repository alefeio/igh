"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { StudentTeacherEvaluation } from "@/components/student/StudentTeacherEvaluation";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";

type PromptItem = {
  enrollmentId: string;
  courseName: string;
  teacherName: string;
};

export function StudentTeacherEvaluationPrompt() {
  const toast = useToast();
  const [items, setItems] = useState<PromptItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/teacher-evaluation-prompt");
        const json = (await res.json()) as ApiResponse<{ items: PromptItem[] }>;
        if (cancelled || !res.ok || !json.ok) return;
        if (json.data.items.length > 0) {
          setItems(json.data.items);
          setOpen(true);
        }
      } catch {
        // O painel segue utilizável se o aviso não carregar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = items[0];

  async function dismiss() {
    if (dismissing) return;
    setDismissing(true);
    try {
      const res = await fetch("/api/me/teacher-evaluation-prompt", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ dismissed: boolean }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível guardar a sua escolha.");
        return;
      }
      setItems([]);
      setOpen(false);
    } finally {
      setDismissing(false);
    }
  }

  if (!open || !current) return null;

  const remaining = items.length - 1;

  return (
    <Modal
      open
      onClose={() => setOpen(false)}
      title="Avalie o professor"
      size="small"
      overlayClassName="z-[110]"
    >
      <p className="text-sm text-[var(--text-muted)]">
        {current.courseName} · Prof. {current.teacherName}
        {remaining > 0
          ? remaining === 1
            ? " Há mais 1 turma sem avaliação."
            : ` Há mais ${remaining} turmas sem avaliação.`
          : ""}
      </p>
      <div className="mt-4">
        <StudentTeacherEvaluation
          key={current.enrollmentId}
          enrollmentId={current.enrollmentId}
          variant="modal"
          onSubmitted={() => {
            const rest = items.slice(1);
            setItems(rest);
            if (rest.length === 0) setOpen(false);
          }}
        />
      </div>
      <div className="mt-4 border-t border-[var(--card-border)] pt-4">
        <button
          type="button"
          disabled={dismissing}
          onClick={() => void dismiss()}
          className="text-sm font-semibold text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline disabled:opacity-50"
        >
          {dismissing ? "Guardando…" : "Não lembrar novamente"}
        </button>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          O aviso não abre de novo. A avaliação continua disponível em Seus cursos. Fechar deixa o aviso para a
          próxima visita.
        </p>
      </div>
    </Modal>
  );
}
