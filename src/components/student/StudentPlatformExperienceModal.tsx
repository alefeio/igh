"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Star } from "lucide-react";

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
    <div className="space-y-3">
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

function TopicCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
      {description != null ? (
        <div className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{description}</div>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function StudentPlatformExperienceModal({ autoPromptOnce = false, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [ratingPlatform, setRatingPlatform] = useState<number | null>(null);
  const [ratingLessons, setRatingLessons] = useState<number | null>(null);
  const [ratingTeacher, setRatingTeacher] = useState<number | null>(null);
  const [commentPlatform, setCommentPlatform] = useState("");
  const [commentLessons, setCommentLessons] = useState("");
  const [commentTeacher, setCommentTeacher] = useState("");
  const [referral, setReferral] = useState("");
  const [ongoingTeachers, setOngoingTeachers] = useState<{ id: string; name: string }[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setRatingPlatform(null);
    setRatingLessons(null);
    setRatingTeacher(null);
    setCommentPlatform("");
    setCommentLessons("");
    setCommentTeacher("");
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
        data?: {
          hasSubmitted?: boolean;
          ongoingTeachers?: { id: string; name: string }[];
        };
      };
      if (res.ok && json.ok && json.data) {
        if (typeof json.data.hasSubmitted === "boolean") {
          setHasSubmitted(json.data.hasSubmitted);
        }
        if (Array.isArray(json.data.ongoingTeachers)) {
          setOngoingTeachers(json.data.ongoingTeachers);
        }
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
    void fetchStatus();
    setOpen(true);
  };

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
      setError("Selecione uma nota de 1 a 10 em cada tópico (plataforma, aulas e professor) antes de enviar.");
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
          commentPlatform: commentPlatform.trim() || undefined,
          commentLessons: commentLessons.trim() || undefined,
          commentTeacher: commentTeacher.trim() || undefined,
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

  const ratingsComplete =
    ratingPlatform != null &&
    ratingLessons != null &&
    ratingTeacher != null &&
    ratingPlatform >= 1 &&
    ratingPlatform <= 10 &&
    ratingLessons >= 1 &&
    ratingLessons <= 10 &&
    ratingTeacher >= 1 &&
    ratingTeacher <= 10;

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
        size="large"
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
          <div className="flex max-h-[min(85vh,720px)] flex-col gap-4">
            <p className="shrink-0 text-center text-xs text-[var(--text-muted)]">
              Cada envio é um novo registro no histórico; respostas anteriores não são excluídas. Em cada bloco há nota e
              espaço para comentário.
            </p>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <TopicCard
                title="Plataforma"
                description={
                  <>
                    De 1 a 10, como você avalia a <strong className="font-semibold text-[var(--text-secondary)]">plataforma</strong>{" "}
                    (navegação, uso geral, organização)?
                  </>
                }
              >
                <TenStarRating
                  value={ratingPlatform}
                  onChange={setRatingPlatform}
                  groupLabel="Nota de 1 a 10 para a plataforma"
                />
                <div className="space-y-1.5">
                  <label htmlFor="exp-comment-platform" className="text-xs font-medium text-[var(--text-primary)]">
                    Comentário sobre a plataforma <span className="font-normal text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <textarea
                    id="exp-comment-platform"
                    value={commentPlatform}
                    onChange={(e) => setCommentPlatform(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder="O que funcionou bem ou poderia melhorar na plataforma…"
                    className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                  />
                </div>
              </TopicCard>

              <TopicCard
                title="Aulas"
                description={
                  <>
                    De 1 a 10, como você avalia as <strong className="font-semibold text-[var(--text-secondary)]">aulas</strong> e o
                    conteúdo oferecido?
                  </>
                }
              >
                <TenStarRating
                  value={ratingLessons}
                  onChange={setRatingLessons}
                  groupLabel="Nota de 1 a 10 para as aulas"
                />
                <div className="space-y-1.5">
                  <label htmlFor="exp-comment-lessons" className="text-xs font-medium text-[var(--text-primary)]">
                    Comentário sobre as aulas <span className="font-normal text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <textarea
                    id="exp-comment-lessons"
                    value={commentLessons}
                    onChange={(e) => setCommentLessons(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder="Material, dinâmica, clareza do conteúdo…"
                    className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                  />
                </div>
              </TopicCard>

              <TopicCard
                title="Professor"
                description={
                  <>
                    Avalie a didática, o apoio e a comunicação. A nota refere-se ao(s) professor(es) abaixo — são os vinculados às
                    suas turmas com status <strong className="font-medium text-[var(--text-secondary)]">em andamento</strong>.
                  </>
                }
              >
                <div className="rounded-lg border border-[var(--igh-primary)]/25 bg-[var(--igh-primary)]/5 px-3 py-2.5">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    Professor(es) — turmas em andamento
                  </p>
                  {ongoingTeachers.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {ongoingTeachers.map((t) => (
                        <li
                          key={t.id}
                          className="text-sm font-semibold text-[var(--text-primary)]"
                        >
                          {t.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                      No momento você não está em turmas &quot;em andamento&quot; com matrícula ativa. A nota e o comentário abaixo
                      referem-se ao apoio dos professores de forma geral.
                    </p>
                  )}
                </div>

                <TenStarRating
                  value={ratingTeacher}
                  onChange={setRatingTeacher}
                  groupLabel="Nota de 1 a 10 para o professor"
                />
                <div className="space-y-1.5">
                  <label htmlFor="exp-comment-teacher" className="text-xs font-medium text-[var(--text-primary)]">
                    Comentário sobre o professor <span className="font-normal text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <textarea
                    id="exp-comment-teacher"
                    value={commentTeacher}
                    onChange={(e) => setCommentTeacher(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder="Didática, retorno às dúvidas, organização das aulas…"
                    className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                  />
                </div>
              </TopicCard>

              <section className="rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/30 p-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Indicação <span className="font-normal text-xs text-[var(--text-muted)]">(opcional)</span>
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Conhece alguém que se beneficiaria dos cursos? Deixe nome, telefone ou outro contato.
                </p>
                <textarea
                  id="platform-exp-referral"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ex.: indicaria fulano — (00) 00000-0000"
                  className="mt-2 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                />
              </section>
            </div>

            {error && (
              <p className="shrink-0 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="shrink-0 border-t border-[var(--card-border)] pt-3">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || !ratingsComplete}
                className="w-full rounded-lg bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
              >
                {submitting ? "Enviando…" : "Enviar avaliação"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
