"use client";

import { Check, Copy, Link2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";
import { STUDENT_REFERRAL_POINTS } from "@/lib/referral-client";

type ReferralsPayload = {
  code: string;
  totals: {
    registered: number;
    firstAttendance: number;
    certified: number;
    points: number;
  };
};

export function ReferralShareCard() {
  const toast = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [totals, setTotals] = useState<ReferralsPayload["totals"] | null>(null);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/referrals");
        const json = (await res.json()) as ApiResponse<ReferralsPayload>;
        if (!cancelled && res.ok && json.ok) {
          setCode(json.data.code);
          setTotals(json.data.totals);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const referralUrl = code ? `${origin || ""}/?ref=${encodeURIComponent(code)}` : "";

  const copyLink = useCallback(async () => {
    if (!code) return;
    const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.push("success", "Link de indicação copiado.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.push("error", "Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }, [code, toast]);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        Compartilhe seu link. Quem se cadastrar por ele fica vinculado a você. Você ganha{" "}
        <strong className="text-[var(--text-primary)]">{STUDENT_REFERRAL_POINTS.registration}</strong> pts no
        cadastro,{" "}
        <strong className="text-[var(--text-primary)]">{STUDENT_REFERRAL_POINTS.firstAttendance}</strong> na 1ª
        presença,{" "}
        <strong className="text-[var(--text-primary)]">{STUDENT_REFERRAL_POINTS.subsequentAttendance}</strong> em
        cada presença seguinte e{" "}
        <strong className="text-[var(--text-primary)]">{STUDENT_REFERRAL_POINTS.certification}</strong> na
        certificação (conta no ranking de alunos).
      </p>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando seu link…</p>
      ) : code ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2.5">
            <Link2 className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            <code className="min-w-0 truncate text-sm text-[var(--text-primary)]">
              {referralUrl || `/?ref=${code}`}
            </code>
          </div>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Não foi possível carregar o link de indicação.</p>
      )}

      {totals ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
            {totals.registered} indicado{totals.registered === 1 ? "" : "s"}
          </span>
          <span>{totals.points} pts por indicações</span>
          <Link
            href="/minhas-indicacoes"
            className="font-semibold text-[var(--igh-primary)] hover:underline"
          >
            Ver detalhes
          </Link>
        </div>
      ) : null}
    </div>
  );
}
