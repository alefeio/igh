"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type EvaluationPayload = {
  available?: boolean;
  teacher: { id: string; name: string } | null;
  evaluation: {
    rating: number;
    comment: string;
    anonymous: boolean;
    updatedAt: string;
  } | null;
};

export function StudentTeacherEvaluation({
  enrollmentId,
  variant = "page",
  onSubmitted,
}: {
  enrollmentId: string;
  variant?: "page" | "modal";
  onSubmitted?: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [saved, setSaved] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/teacher-evaluation`);
        const json = (await res.json()) as ApiResponse<EvaluationPayload>;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Não foi possível carregar a avaliação.");
          return;
        }
        if (json.data.available === false) {
          setAvailable(false);
          return;
        }
        setAvailable(true);
        setTeacherName(json.data.teacher?.name ?? "");
        if (json.data.evaluation) {
          setRating(json.data.evaluation.rating);
          setComment(json.data.evaluation.comment);
          setAnonymous(json.data.evaluation.anonymous);
          setSaved(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enrollmentId, toast]);

  useEffect(() => {
    if (variant !== "page" || loading || window.location.hash !== "#avaliar-professor") return;
    document.getElementById("avaliar-professor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, variant]);

  async function submit() {
    if (rating < 1 || saving) return;
    if (!comment.trim()) {
      toast.push("error", "Escreva um comentário antes de enviar.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/teacher-evaluation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, anonymous }),
      });
      const json = (await res.json()) as ApiResponse<EvaluationPayload>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível salvar a avaliação.");
        return;
      }
      setSaved(true);
      setTeacherName(json.data.teacher?.name ?? teacherName);
      toast.push("success", saved ? "Avaliação atualizada." : "Avaliação enviada.");
      onSubmitted?.();
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !available) return null;

  const form = (
    <>
      {variant === "page" ? (
        <h2 id="avaliar-professor-heading" className="text-base font-semibold text-[var(--text-primary)]">
          Avalie o professor
        </h2>
      ) : null}
      <p className={variant === "page" ? "mt-1 text-sm text-[var(--text-muted)]" : "text-sm text-[var(--text-muted)]"}>
        {teacherName ? `Como foi a experiência com ${teacherName}? ` : ""}
        A nota vai de 1 a 5. O comentário é obrigatório.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Carregando avaliação…</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]" id="nota-professor">
              Nota
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="nota-professor">
              {[1, 2, 3, 4, 5].map((value) => {
                const selected = rating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRating(value)}
                    className={`h-10 w-10 rounded-full border text-sm font-semibold ${
                      selected
                        ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                        : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:border-[var(--igh-primary)]/50"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
            Comentário
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              rows={4}
              required
              placeholder="Conte como foi a experiência com o professor"
              className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-normal text-[var(--text-primary)]"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              className="mt-1"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
            />
            <span>
              <span className="font-medium">Enviar de forma anônima para o professor</span>
              <span className="mt-1 block font-normal text-[var(--text-muted)]">
                Se marcar esta opção, o professor não saberá que esta mensagem é sua. O coordenador saberá a sua
                identidade para tomar as providências necessárias.
              </span>
            </span>
          </label>
          <div>
            <button
              type="button"
              disabled={rating < 1 || !comment.trim() || saving}
              onClick={() => void submit()}
              className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Enviando…" : saved ? "Atualizar avaliação" : "Enviar avaliação"}
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (variant === "modal") return form;

  return (
    <section
      id="avaliar-professor"
      className="scroll-mt-24 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 sm:p-5"
      aria-labelledby="avaliar-professor-heading"
    >
      {form}
    </section>
  );
}
