"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RichTextViewer } from "@/components/ui/RichTextViewer";
import type { ApiResponse } from "@/lib/api-types";

const STORAGE_KEY = "igh_public_cookie_v1";

type CookieBlock = {
  id: string;
  versionLabel: string;
  title: string;
  contentRich: string;
  publishedAt: string;
};

type CurrentLegal = {
  cookie: CookieBlock | null;
};

function readStored(): { v: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { v?: string };
    return j.v ? { v: j.v } : null;
  } catch {
    return null;
  }
}

function writeStored(v: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ v, at: new Date().toISOString() }));
}

/**
 * Rotas **públicas** (site institucional, login, etc.): apenas consentimento de cookies.
 * Termos e privacidade no painel: `LegalConsentBanner`.
 */
export function CookieConsentBanner() {
  const [cookie, setCookie] = useState<CookieBlock | null | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/legal/current", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<CurrentLegal>;
      if (!res.ok || !json.ok || !json.data) {
        setCookie(null);
        return;
      }
      setCookie(json.data.cookie);
    } catch {
      setCookie(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (cookie === undefined) return;
    const stored = readStored();
    const expected = cookie !== null ? cookie.id : "essential";
    if (stored?.v === expected) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [cookie]);

  const accept = () => {
    setBusy(true);
    try {
      const v = cookie !== null && cookie !== undefined ? cookie.id : "essential";
      writeStored(v);
      setVisible(false);
      setDetailsOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!visible || cookie === undefined) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-[95] border-t border-[var(--card-border)] bg-[var(--card-bg)]/95 px-4 py-3 shadow-[0_-6px_24px_rgba(0,0,0,0.1)] backdrop-blur-md"
        role="region"
        aria-label="Cookies"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 text-sm text-[var(--text-primary)]">
            <p className="font-semibold">Este site utiliza cookies</p>
            {cookie ? (
              <p className="mt-1 text-[var(--text-muted)]">
                Usamos cookies e tecnologias similares necessários ao funcionamento e, quando descrito no texto, para
                melhorar a experiência. Consulte a{" "}
                <button
                  type="button"
                  className="font-medium text-[var(--igh-primary)] underline hover:no-underline"
                  onClick={() => setDetailsOpen(true)}
                >
                  política de cookies
                </button>{" "}
                e a{" "}
                <Link href="/privacidade" className="font-medium text-[var(--igh-primary)] underline hover:no-underline">
                  política de privacidade
                </Link>
                .
              </p>
            ) : (
              <p className="mt-1 text-[var(--text-muted)]">
                Utilizamos cookies estritamente necessários ao funcionamento do site. Para mais informações sobre dados
                pessoais, consulte a{" "}
                <Link href="/privacidade" className="font-medium text-[var(--igh-primary)] underline hover:no-underline">
                  política de privacidade
                </Link>
                .
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {cookie ? (
              <Button type="button" variant="secondary" onClick={() => setDetailsOpen(true)}>
                Ler política
              </Button>
            ) : null}
            <Button type="button" onClick={accept} disabled={busy}>
              {busy ? "…" : "Aceitar cookies"}
            </Button>
          </div>
        </div>
      </div>

      {cookie ? (
        <Modal
          open={detailsOpen}
          title={cookie.title?.trim() || "Política de cookies"}
          onClose={() => setDetailsOpen(false)}
          size="large"
          overlayClassName="z-[105]"
        >
          <div className="max-h-[min(70vh,520px)] overflow-y-auto">
            <p className="text-xs text-[var(--text-muted)]">
              Versão {cookie.versionLabel} · {new Date(cookie.publishedAt).toLocaleString("pt-BR")}
            </p>
            <RichTextViewer content={cookie.contentRich} className="mt-4 text-[var(--text-primary)]" />
          </div>
          <div className="border-t border-[var(--card-border)] px-4 py-3">
            <Button type="button" className="w-full sm:w-auto" onClick={accept} disabled={busy}>
              Aceitar cookies
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
