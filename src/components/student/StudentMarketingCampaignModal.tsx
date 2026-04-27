"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Heart } from "lucide-react";

const STORAGE_AUTO_ONCE_PREFIX = "student-marketing-campaign-auto-shown:";

function TenHeartRating({
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
      <div className="flex flex-wrap items-center justify-center gap-1" role="group" aria-label={groupLabel}>
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
              <Heart
                className={`h-8 w-8 ${active ? "" : "text-[var(--text-muted)]"}`}
                style={
                  active ? { color: "#e11d48", fill: "#e11d48", stroke: "#e11d48" } : undefined
                }
                strokeWidth={active ? 0 : 1.5}
              />
            </button>
          );
        })}
      </div>
      {value != null && (
        <p className="text-center text-sm font-medium text-[var(--igh-primary)]">{value}/10</p>
      )}
    </div>
  );
}

type ActiveCampaign = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

type FeedItem = {
  id: string;
  isMine: boolean;
  authorLabel: string;
  ratingStars: number;
  comment: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
};

type ModalMode = "form" | "feed";

export function StudentMarketingCampaignModal({
  autoPromptOnce = false,
  className = "",
}: {
  autoPromptOnce?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("form");
  const [campaign, setCampaign] = useState<ActiveCampaign | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [ratingStars, setRatingStars] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);

  const storageAutoKey = useMemo(
    () => (campaign?.slug ? `${STORAGE_AUTO_ONCE_PREFIX}${campaign.slug}` : null),
    [campaign?.slug]
  );

  const resetForm = useCallback(() => {
    setRatingStars(null);
    setComment("");
    setError(null);
  }, []);

  const refreshCampaign = useCallback(async (): Promise<{
    campaign: ActiveCampaign | null;
    hasResponded: boolean;
  } | null> => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/me/marketing-campaigns/active", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { campaign?: ActiveCampaign | null; hasResponded?: boolean };
      };
      if (res.ok && json.ok && json.data) {
        const c = (json.data.campaign as ActiveCampaign | null) ?? null;
        const hr = !!json.data.hasResponded;
        setCampaign(c);
        setHasResponded(hr);
        return { campaign: c, hasResponded: hr };
      }
      return null;
    } catch {
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void refreshCampaign();
  }, [refreshCampaign]);

  const loadFeed = useCallback(async (campaignId: string) => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const res = await fetch(`/api/me/marketing-campaigns/${campaignId}/feed`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { items?: FeedItem[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setFeedError(json.error?.message ?? "Não foi possível carregar as declarações.");
        setFeedItems([]);
        return;
      }
      setFeedItems(json.data?.items ?? []);
    } catch {
      setFeedError("Falha de rede ao carregar declarações.");
      setFeedItems([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoPromptOnce || loadingStatus) return;
    if (!campaign || hasResponded) return;
    if (typeof window === "undefined") return;
    if (!storageAutoKey) return;
    if (window.localStorage.getItem(storageAutoKey)) return;
    const t = window.setTimeout(() => {
      window.localStorage.setItem(storageAutoKey, "1");
      setModalMode("form");
      setOpen(true);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [autoPromptOnce, campaign, hasResponded, loadingStatus, storageAutoKey]);

  const openModal = async () => {
    const r = await refreshCampaign();
    if (!r?.campaign) return;
    if (r.hasResponded) {
      setModalMode("feed");
      setOpen(true);
      await loadFeed(r.campaign.id);
    } else {
      resetForm();
      setModalMode("form");
      setOpen(true);
    }
  };

  const closeModal = () => {
    setOpen(false);
    setFeedError(null);
    if (modalMode === "form") resetForm();
  };

  async function submit() {
    if (!campaign) return;
    if (ratingStars == null || ratingStars < 1 || ratingStars > 10) {
      setError("Selecione uma nota de 1 a 10 corações antes de enviar.");
      return;
    }
    if (!comment.trim()) {
      setError("O campo de comentário é obrigatório.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/me/marketing-campaigns/${campaign.id}/response`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratingStars, comment: comment.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Não foi possível enviar. Tente de novo.");
        return;
      }
      setHasResponded(true);
      setModalMode("feed");
      await loadFeed(campaign.id);
    } catch {
      setError("Falha de rede. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(item: FeedItem) {
    if (!campaign || item.isMine || likeBusyId) return;
    const nextLiked = !item.likedByMe;
    setLikeBusyId(item.id);
    setFeedError(null);
    try {
      const res = await fetch(`/api/me/marketing-campaigns/${campaign.id}/responses/${item.id}/like`, {
        method: nextLiked ? "POST" : "DELETE",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { likeCount?: number; liked?: boolean };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setFeedError(json.error?.message ?? "Não foi possível atualizar a curtida.");
        return;
      }
      const likeCount = json.data?.likeCount ?? item.likeCount;
      const likedByMe = json.data?.liked ?? nextLiked;
      setFeedItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, likeCount, likedByMe } : row
        )
      );
    } catch {
      setFeedError("Falha de rede ao curtir.");
    } finally {
      setLikeBusyId(null);
    }
  }

  if (!campaign) return null;

  const modalTitle = modalMode === "feed" ? campaign.title : "Avalie sua mãe";

  return (
    <>
      <button
        type="button"
        onClick={() => void openModal()}
        disabled={loadingStatus}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] disabled:opacity-50 ${className}`}
      >
        <Heart className="h-4 w-4 text-rose-500" aria-hidden />
        {hasResponded ? "Ver campanha" : "Avalie sua mãe"}
      </button>

      <Modal open={open} onClose={closeModal} title={modalTitle} size="large">
        {modalMode === "feed" ? (
          <div className="flex max-h-[min(85vh,720px)] flex-col gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Declarações dos colegas — curta as que mais tocarem você.
            </p>
            {feedLoading ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : feedError ? (
              <p className="py-4 text-center text-sm text-red-600">{feedError}</p>
            ) : feedItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                Ainda não há outras declarações para exibir.
              </p>
            ) : (
              <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {feedItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">{item.authorLabel}</span>
                        {item.isMine ? (
                          <span className="ml-2 rounded-md bg-[var(--igh-primary)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--igh-primary)]">
                            Você
                          </span>
                        ) : null}
                        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          {item.ratingStars}/10 ·{" "}
                          {new Date(item.createdAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={item.isMine || likeBusyId === item.id}
                        onClick={() => void toggleLike(item)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          item.likedByMe
                            ? "border-rose-400 bg-rose-500/15 text-rose-600"
                            : "border-[var(--card-border)] text-[var(--text-muted)] hover:border-[var(--igh-primary)]/40"
                        }`}
                        aria-pressed={item.likedByMe}
                        aria-label={item.isMine ? "Sua declaração" : item.likedByMe ? "Descurtir" : "Curtir"}
                      >
                        <Heart
                          className="h-3.5 w-3.5"
                          style={
                            item.likedByMe
                              ? { color: "#e11d48", fill: "#e11d48", stroke: "#e11d48" }
                              : { stroke: "currentColor" }
                          }
                          strokeWidth={item.likedByMe ? 0 : 1.5}
                          aria-hidden
                        />
                        <span>{item.likeCount}</span>
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                      {item.comment || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex max-h-[min(85vh,720px)] flex-col gap-4">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{campaign.title}</h3>
              {campaign.description ? (
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{campaign.description}</p>
              ) : null}
              <div className="mt-4 space-y-4">
                <TenHeartRating value={ratingStars} onChange={setRatingStars} groupLabel="Avaliação em corações" />
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">Comente aqui</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    className="theme-input w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--igh-primary)] focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)]"
                    placeholder="Escreva aqui..."
                  />
                </div>
              </div>
            </div>

            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || ratingStars == null || !comment.trim()}
              className="w-full rounded-lg bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviar avaliação"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
