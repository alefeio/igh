"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RichTextViewer } from "@/components/ui/RichTextViewer";
import type { ApiResponse } from "@/lib/api-types";
import {
  hasTermsOrPrivacyPublished,
  legalTermsPrivacyMatches,
  type StoredTermsPrivacy,
  type TermsPrivacyBundle,
} from "@/lib/legal-acceptance-utils";

const STORAGE_KEY = "igh_legal_accept_v1";

type LegalBlock = {
  id: string;
  versionLabel: string;
  title: string;
  contentRich: string;
  publishedAt: string;
};

type CurrentBundle = {
  terms: LegalBlock | null;
  privacy: LegalBlock | null;
  cookie: LegalBlock | null;
};

function toTermsPrivacy(b: CurrentBundle): TermsPrivacyBundle {
  return {
    terms: b.terms ? { id: b.terms.id } : null,
    privacy: b.privacy ? { id: b.privacy.id } : null,
  };
}

function readLocalTermsPrivacy(): StoredTermsPrivacy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { t?: string | null; p?: string | null };
    return {
      termsVersionId: j.t ?? null,
      privacyVersionId: j.p ?? null,
    };
  } catch {
    return null;
  }
}

function writeLocalTermsPrivacy(s: StoredTermsPrivacy) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      t: s.termsVersionId,
      p: s.privacyVersionId,
      at: new Date().toISOString(),
    }),
  );
}

function buildAcceptPayload(bundle: CurrentBundle): StoredTermsPrivacy {
  return {
    termsVersionId: bundle.terms?.id ?? null,
    privacyVersionId: bundle.privacy?.id ?? null,
  };
}

/**
 * Termos de uso e política de privacidade — **apenas na área autenticada** (painel).
 * Rotas públicas usam `CookieConsentBanner`.
 */
type MeLegalState =
  | { loaded: false }
  | {
      loaded: true;
      acceptance: StoredTermsPrivacy | null;
    };

export function LegalConsentBanner() {
  const [bundle, setBundle] = useState<CurrentBundle | null>(null);
  const [me, setMe] = useState<MeLegalState>({ loaded: false });
  const [visible, setVisible] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"terms" | "privacy">("terms");
  const [busy, setBusy] = useState(false);

  const tp = useMemo(() => (bundle ? toTermsPrivacy(bundle) : null), [bundle]);

  const load = useCallback(async () => {
    try {
      const [curRes, meRes] = await Promise.all([
        fetch("/api/legal/current", { cache: "no-store" }),
        fetch("/api/me/legal-acceptance", { credentials: "include", cache: "no-store" }),
      ]);
      const curJson = (await curRes.json()) as ApiResponse<CurrentBundle>;
      if (!curRes.ok || !curJson.ok || !curJson.data) {
        setBundle(null);
        setMe({ loaded: true, acceptance: null });
        return;
      }
      setBundle(curJson.data);

      const meJson = (await meRes.json()) as ApiResponse<{
        authenticated: boolean;
        acceptance: {
          termsVersionId: string | null;
          privacyVersionId: string | null;
          cookieVersionId: string | null;
        } | null;
      }>;
      if (meRes.ok && meJson.ok && meJson.data) {
        const d = meJson.data;
        const a = d.acceptance;
        if (d.authenticated && a) {
          setMe({
            loaded: true,
            acceptance: {
              termsVersionId: a.termsVersionId,
              privacyVersionId: a.privacyVersionId,
            },
          });
        } else {
          setMe({ loaded: true, acceptance: null });
        }
      } else {
        setMe({ loaded: true, acceptance: null });
      }
    } catch {
      setBundle(null);
      setMe({ loaded: true, acceptance: null });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bundle || !tp || !me.loaded) return;
    if (!hasTermsOrPrivacyPublished(tp)) {
      setVisible(false);
      return;
    }

    const local = readLocalTermsPrivacy();
    const fromServer = me.acceptance;

    const effective: StoredTermsPrivacy | null = fromServer ?? local;

    if (effective && legalTermsPrivacyMatches(tp, effective)) {
      setVisible(false);
      return;
    }

    setVisible(true);
  }, [bundle, tp, me]);

  const accept = async () => {
    if (!bundle) return;
    setBusy(true);
    try {
      const body = {
        termsVersionId: bundle.terms?.id ?? null,
        privacyVersionId: bundle.privacy?.id ?? null,
      };
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        return;
      }
      writeLocalTermsPrivacy(body);
      setVisible(false);
      setDetailsOpen(false);
      void load();
    } finally {
      setBusy(false);
    }
  };

  const docForTab = useMemo(() => {
    if (!bundle) return null;
    return detailTab === "terms" ? bundle.terms : bundle.privacy;
  }, [bundle, detailTab]);

  if (!visible || !bundle || !tp || !hasTermsOrPrivacyPublished(tp)) {
    return null;
  }

  const modalTitle = detailTab === "terms" ? "Termos de uso" : "Política de privacidade";

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-[var(--card-border)] bg-[var(--card-bg)]/95 px-4 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md"
        role="region"
        aria-label="Termos e privacidade"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 text-sm text-[var(--text-primary)]">
            <p className="font-semibold">Termos de uso e privacidade</p>
            <p className="mt-1 text-[var(--text-muted)]">
              Para continuar a usar o painel, confirme que leu e aceita os{" "}
              {bundle.terms ? (
                <button
                  type="button"
                  className="font-medium text-[var(--igh-primary)] underline hover:no-underline"
                  onClick={() => {
                    setDetailTab("terms");
                    setDetailsOpen(true);
                  }}
                >
                  Termos de uso
                </button>
              ) : (
                "Termos de uso"
              )}
              {bundle.privacy ? (
                <>
                  {" "}
                  e a{" "}
                  <button
                    type="button"
                    className="font-medium text-[var(--igh-primary)] underline hover:no-underline"
                    onClick={() => {
                      setDetailTab("privacy");
                      setDetailsOpen(true);
                    }}
                  >
                    Política de privacidade
                  </button>
                </>
              ) : null}
              .
            </p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
              {bundle.terms ? (
                <Link href="/termos" className="text-[var(--igh-primary)] underline hover:no-underline" target="_blank">
                  Abrir termos (site)
                </Link>
              ) : null}
              {bundle.privacy ? (
                <Link href="/privacidade" className="text-[var(--igh-primary)] underline hover:no-underline" target="_blank">
                  Abrir privacidade (site)
                </Link>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDetailTab(bundle.terms ? "terms" : "privacy");
                setDetailsOpen(true);
              }}
            >
              Ver detalhes
            </Button>
            <Button type="button" onClick={() => void accept()} disabled={busy}>
              {busy ? "Salvando…" : "Li e aceito"}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={detailsOpen}
        title={modalTitle}
        onClose={() => setDetailsOpen(false)}
        size="large"
        overlayClassName="z-[110]"
      >
        {bundle.terms && bundle.privacy ? (
          <div className="border-b border-[var(--card-border)] px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {bundle.terms ? (
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    detailTab === "terms"
                      ? "bg-[var(--igh-primary)] text-white"
                      : "bg-[var(--igh-surface)] text-[var(--text-primary)]"
                  }`}
                  onClick={() => setDetailTab("terms")}
                >
                  Termos
                </button>
              ) : null}
              {bundle.privacy ? (
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    detailTab === "privacy"
                      ? "bg-[var(--igh-primary)] text-white"
                      : "bg-[var(--igh-surface)] text-[var(--text-primary)]"
                  }`}
                  onClick={() => setDetailTab("privacy")}
                >
                  Privacidade
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="max-h-[min(70vh,560px)] overflow-y-auto px-4 py-4">
          {docForTab ? (
            <>
              <p className="text-xs text-[var(--text-muted)]">
                Versão {docForTab.versionLabel} · {new Date(docForTab.publishedAt).toLocaleString("pt-BR")}
              </p>
              {docForTab.title ? <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{docForTab.title}</p> : null}
              <RichTextViewer content={docForTab.contentRich} className="mt-4 text-[var(--text-primary)]" />
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Nenhum documento nesta aba.</p>
          )}
        </div>
        <div className="border-t border-[var(--card-border)] px-4 py-3">
          <Button type="button" className="w-full sm:w-auto" onClick={() => void accept()} disabled={busy}>
            {busy ? "Salvando…" : "Li e aceito"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
