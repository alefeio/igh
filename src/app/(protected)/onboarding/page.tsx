"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";
import { RichTextViewer } from "@/components/ui/RichTextViewer";
import type { ApiResponse } from "@/lib/api-types";

type OnboardingPayload = {
  role: string;
  title: string;
  contentRich: string;
  updatedAt: string | null;
  updatedByName: string | null;
  isEmpty?: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  MASTER: "Master",
  ADMIN: "Administrador",
  COORDINATOR: "Coordenador",
  TEACHER: "Professor",
  STUDENT: "Aluno",
};

export default function OnboardingPage() {
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OnboardingPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        const json = (await res.json()) as ApiResponse<OnboardingPayload>;
        if (!cancelled && res.ok && json.ok && json.data) {
          setData(json.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/onboarding/visit", { method: "POST" }).catch(() => {});
  }, [user]);

  const roleLabel = user ? ROLE_LABEL[user.role] ?? user.role : "";

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <DashboardHero
        eyebrow="Ajuda"
        title={data?.title ?? "Como usar o sistema"}
        description={
          <>
            Conteúdo pensado para o seu perfil: <strong>{roleLabel}</strong>. Use o menu lateral para explorar as
            funcionalidades; volte aqui quando quiser revisar o guia.
            {(user?.role === "MASTER" || user?.role === "ADMIN") && (
              <span className="mt-2 block text-sm">
                <Link
                  href="/admin/onboarding"
                  className="font-semibold text-[var(--igh-primary)] underline hover:opacity-90"
                >
                  Editar guias e ver quem acessou →
                </Link>
              </span>
            )}
          </>
        }
      />

      <SectionCard title="Guia" variant="elevated" className="min-h-[200px]">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : data?.isEmpty || !data?.contentRich?.trim() ? (
          <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              O conteúdo deste guia ainda não foi publicado para o seu perfil. Entre em contato com a equipe ou aguarde a
              atualização do administrador.
            </p>
            {(user?.role === "MASTER" || user?.role === "ADMIN") && (
              <Link
                href="/admin/onboarding"
                className="mt-4 inline-block text-sm font-semibold text-[var(--igh-primary)] underline"
              >
                Criar conteúdo no painel de onboarding
              </Link>
            )}
          </div>
        ) : (
          <>
            {data.updatedAt && (
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
                {data.updatedByName ? ` · ${data.updatedByName}` : ""}
              </p>
            )}
            <RichTextViewer content={data.contentRich} className="text-[var(--text-primary)]" />
          </>
        )}
      </SectionCard>
    </div>
  );
}
