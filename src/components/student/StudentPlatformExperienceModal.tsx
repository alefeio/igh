"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Star } from "lucide-react";

const STEPS = 5 as const;
/** Uma vez por navegador: abre o modal automaticamente se o aluno ainda não avaliou. */
const STORAGE_AUTO_ONCE = "student-platform-experience-auto-shown";

type Props = {
  /** Se true, tenta abrir o modal uma vez (após um pequeno atraso) na primeira visita ao painel neste navegador. */
  autoPromptOnce?: boolean;
  className?: string;
};

function TenStarRating({
  value,
  onChange,
  groupLabel,
}: {
  value: number | null;
  onChange: (n: number) => void;
  groupLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-0.5" role="group" aria-label={groupLabel}>
        {Array.from({ length: 10 }, (_, i) => {
          const v = i + 1;
          const active = value != null && v <= value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="cursor-pointer rounded-md p-0.5 touch-manipulation focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)]"
              aria-label={`Nota ${v} de 10`}
              aria-pressed={value === v || (value != null && v <= value)}
            >
              <Star
                className={`h-7 w-7 sm:h-8 sm:w-8 ${active ? "fill-amber-400 text-amber-500" : "text-[var(--text-muted)]"}`}
                strokeWidth={active ? 0 : 1.5}
              />
            </button>
          );
        })}
      </div>
      {value != null && (
        <p className="text-center text-sm font-medium text-[var(--igh-primary)]">
          {value}/10
        </p>
      )}
    </div>
  );
}

export function StudentPlatformExperienceModal({ autoPromptOnce = false, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [ratingPlatform, setRatingPlatform] = useState<number | null>(null);
  const [ratingLessons, setRatingLessons] = useState<number | null>(null);
  const [ratingTeacher, setRatingTeacher] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [referral, setReferral] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setStep(1);
    setRatingPlatform(null);
    setRatingLessons(null);
    setRatingTeacher(null);
    setComment("");
    setReferral("");
    setError(null);
    setSuccess(false);
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/me/platform-experience", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { hasSubmitted?: boolean };
      };
      if (res.ok && json.ok && typeof json.data?.hasSubmitted === "boolean") {
        setHasSubmitted(json.data.hasSubmitted);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoPromptOnce || loadingStatus || hasSubmitted) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_AUTO_ONCE)) return;
    const t = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_AUTO_ONCE, "1");
      setOpen(true);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [autoPromptOnce, loadingStatus, hasSubmitted]);

  const closeModal = () => {
    setOpen(false);
    if (!success) resetForm();
  };

  const openModal = () => {
    resetForm();
    setOpen(true);
  };

  const canNextStep1 = ratingPlatform != null && ratingPlatform >= 1 && ratingPlatform <= 10;
  const canNextStep2 = ratingLessons != null && ratingLessons >= 1 && ratingLessons <= 10;
  const canNextStep3 = ratingTeacher != null && ratingTeacher >= 1 && ratingTeacher <= 10;

  function stepRatingComplete(s: number): boolean {
    if (s === 1) return canNextStep1;
    if (s === 2) return canNextStep2;
    if (s === 3) return canNextStep3;
    return true;
  }

  async function submit() {
    if (
      ratingPlatform == null ||
      ratingLessons == null ||
      ratingTeacher == null ||
      ratingPlatform < 1 ||
      ratingPlatform > 10 ||
      ratingLessons < 1 ||
      ratingLessons > 10 ||
      ratingTeacher < 1 ||
      ratingTeacher > 10
    ) {
      setError("Preencha as três notas de 1 a 10 antes de enviar.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/platform-experience", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratingPlatform,
          ratingLessons,
          ratingTeacher,
          comment: comment.trim() || undefined,
          referral: referral.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setError(
          json.error?.message ?? "Não foi possível enviar. Tente de novo.",
        );
        return;
      }
      setSuccess(true);
      setHasSubmitted(true);
    } catch {
      setError("Falha de rede. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={loadingStatus}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] disabled:opacity-50 ${className}`}
      >
        <Star className="h-4 w-4 text-amber-500" aria-hidden />
        {hasSubmitted ? "Nova avaliação" : "Avaliar experiência"}
      </button>

      <Modal
        open={open}
        onClose={closeModal}
        title="Sua avaliação"
        size="small"
      >
        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[var(--text-primary)]">
              Obrigado! Sua avaliação foi registrada e nos ajuda a melhorar.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              As avaliações anteriores continuam salvas; nada foi apagado.
            </p>
            <button
              type="button"
              onClick={closeModal}
              className="w-full rounded-lg bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)]">
              {Array.from({ length: STEPS }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 max-w-[3rem] rounded-full ${i + 1 <= step ? "bg-[var(--igh-primary)]" : "bg-[var(--igh-surface)]"}`}
                />
              ))}
            </div>
            <p className="text-center text-xs text-[var(--text-muted)]">
              Etapa {step} de {STEPS}
            </p>
            <p className="text-center text-xs text-[var(--text-muted)]">
              Cada envio é um novo registro no histórico; respostas anteriores não são excluídas.
            </p>

            {step === 1 && (
              <div className="space-y-2">
                <p className="text-center text-sm text-[var(--text-primary)]">
                  De 1 a 10, como você avalia a <strong className="font-semibold">plataforma</strong> (navegação, uso geral,
                  organização)?
                </p>
                <TenStarRating
                  value={ratingPlatform}
                  onChange={setRatingPlatform}
                  groupLabel="Nota de 1 a 10 para a plataforma"
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <p className="text-center text-sm text-[var(--text-primary)]">
                  De 1 a 10, como você avalia as <strong className="font-semibold">aulas</strong> e o conteúdo oferecido?
                </p>
                <TenStarRating
                  value={ratingLessons}
                  onChange={setRatingLessons}
                  groupLabel="Nota de 1 a 10 para as aulas"
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2">
                <p className="text-center text-sm text-[var(--text-primary)]">
                  De 1 a 10, como você avalia o <strong className="font-semibold">professor</strong> (didática, apoio,
                  comunicação)?
                </p>
                <TenStarRating
                  value={ratingTeacher}
                  onChange={setRatingTeacher}
                  groupLabel="Nota de 1 a 10 para o professor"
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2">
                <label htmlFor="platform-exp-comment" className="text-sm font-medium text-[var(--text-primary)]">
                  Comentário <span className="font-normal text-[var(--text-muted)]">(opcional)</span>
                </label>
                <textarea
                  id="platform-exp-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Conte o que mais gostou ou o que podemos melhorar…"
                  className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-2">
                <label htmlFor="platform-exp-referral" className="text-sm font-medium text-[var(--text-primary)]">
                  Indicação <span className="font-normal text-[var(--text-muted)]">(opcional)</span>
                </label>
                <p className="text-xs text-[var(--text-muted)]">
                  Conhece alguém que se beneficiaria dos cursos? Deixe nome, telefone ou outro contato.
                </p>
                <textarea
                  id="platform-exp-referral"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ex.: indicaria fulano — (00) 00000-0000"
                  className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s > 1 ? s - 1 : s))}
                  disabled={submitting}
                  className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--igh-surface)] disabled:opacity-50"
                >
                  Voltar
                </button>
              )}
              <div className="ml-auto flex gap-2">
                {step < STEPS ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!stepRatingComplete(step)) {
                        setError("Selecione uma nota de 1 a 10.");
                        return;
                      }
                      setError(null);
                      setStep((s) => Math.min(STEPS, s + 1));
                    }}
                    disabled={!stepRatingComplete(step)}
                    className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
                  >
                    Próximo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={submitting}
                    className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
                  >
                    {submitting ? "Enviando…" : "Enviar avaliação"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
