"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApimagesFormationUpload } from "@/components/admin/ApimagesFormationUpload";
import { ApimagesImageUpload } from "@/components/admin/ApimagesImageUpload";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import type { ApiResponse } from "@/lib/api-types";

type Role = "MASTER" | "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";

const ROLES: { value: Role; label: string }[] = [
  { value: "MASTER", label: "Master" },
  { value: "ADMIN", label: "Administrador" },
  { value: "COORDINATOR", label: "Coordenador" },
  { value: "TEACHER", label: "Professor" },
  { value: "STUDENT", label: "Aluno" },
];

type VisitRow = {
  id: string;
  role: Role;
  firstSeenAt: string;
  lastSeenAt: string;
  viewCount: number;
  user: { id: string; name: string; email: string; role: Role };
};

export default function AdminOnboardingPage() {
  const toast = useToast();
  const [roleTab, setRoleTab] = useState<Role>("MASTER");
  const [title, setTitle] = useState("");
  const [contentRich, setContentRich] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [summary, setSummary] = useState<{ distinctUsers: number; totalViews: number } | null>(null);
  const [loadingVisits, setLoadingVisits] = useState(true);

  const loadGuide = useCallback(async (r: Role) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/onboarding/guides/${r}`);
      const json = (await res.json()) as ApiResponse<{
        guide: { title: string; contentRich: string; updatedAt: string | null; updatedBy: { name: string } | null };
      }>;
      if (!res.ok || !json.ok || !json.data?.guide) {
        toast.push("error", "Falha ao carregar o guia.");
        return;
      }
      const g = json.data.guide;
      setTitle(g.title ?? "");
      setContentRich(g.contentRich ?? "");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadVisits = useCallback(async () => {
    setLoadingVisits(true);
    try {
      const res = await fetch("/api/admin/onboarding/visits");
      const json = (await res.json()) as ApiResponse<{
        visits: VisitRow[];
        summary: { distinctUsers: number; totalViews: number };
      }>;
      if (res.ok && json.ok && json.data) {
        setVisits(json.data.visits);
        setSummary(json.data.summary);
      }
    } finally {
      setLoadingVisits(false);
    }
  }, []);

  useEffect(() => {
    void loadGuide(roleTab);
  }, [roleTab, loadGuide]);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/onboarding/guides/${roleTab}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), contentRich }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", "Falha ao salvar.");
        return;
      }
      toast.push("success", "Guia salvo.");
      void loadVisits();
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = useMemo(() => ROLES.find((x) => x.value === roleTab)?.label ?? roleTab, [roleTab]);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <DashboardHero
        eyebrow="Administração"
        title="Onboarding do sistema"
        description="Crie o guia por perfil (rich text e imagens). Os usuários veem apenas o conteúdo do próprio perfil na página «Como usar o sistema». Abaixo: quem já abriu a página de onboarding."
      />

      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRoleTab(r.value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              roleTab === r.value
                ? "bg-[var(--igh-primary)] text-white"
                : "border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] hover:opacity-90"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <SectionCard title={`Editar: ${roleLabel}`} variant="elevated">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Título da página</label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Bem-vindo ao painel" />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Imagens para o conteúdo</label>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Envie uma imagem e use o botão «Imagem» no editor abaixo para colar a URL, ou copie o link abaixo do
                upload.
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <ApimagesImageUpload
                  kind="onboarding"
                  onUploaded={(url) => {
                    void navigator.clipboard?.writeText(url).catch(() => {});
                    toast.push("success", "URL copiada. Use o botão «Imagem» no editor para colar, ou Ctrl+V no texto.");
                  }}
                  label="Upload de imagem"
                />
                <div className="min-w-[200px] flex-1">
                  <ApimagesFormationUpload
                    siteKind="onboarding"
                    onUploaded={(url) => {
                      void navigator.clipboard?.writeText(url).catch(() => {});
                      toast.push("success", "URL do arquivo copiada. Cole no conteúdo como link se necessário.");
                    }}
                    label="PDF / Office (link para download)"
                    multiple
                  />
                </div>
              </div>
            </div>

            <div data-tour="onboarding-rich-text">
              <label className="text-sm font-medium text-[var(--text-primary)]">Conteúdo (rich text)</label>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Mesmo editor das aulas: negrito, listas, tabelas, links e imagens por URL.
              </p>
              <RichTextEditor
                key={roleTab}
                value={contentRich}
                onChange={setContentRich}
                minHeight="280px"
                className="mt-2"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? "Salvando…" : "Salvar guia"}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Quem acessou o onboarding" variant="elevated">
        {loadingVisits ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <>
            {summary && (
              <p className="mb-4 text-sm text-[var(--text-muted)]">
                <strong className="text-[var(--text-primary)]">{summary.distinctUsers}</strong> usuários distintos ·{" "}
                <strong className="text-[var(--text-primary)]">{summary.totalViews}</strong> acessos registrados (somando
                visitas)
              </p>
            )}
            <div className="overflow-x-auto rounded-md border border-[var(--card-border)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
                    <th className="px-3 py-2 font-semibold">Usuário</th>
                    <th className="px-3 py-2 font-semibold">E-mail</th>
                    <th className="px-3 py-2 font-semibold">Perfil (última visita)</th>
                    <th className="px-3 py-2 font-semibold">1º acesso</th>
                    <th className="px-3 py-2 font-semibold">Último acesso</th>
                    <th className="px-3 py-2 font-semibold">Visitas</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-[var(--text-muted)]">
                        Ninguém acessou a página de onboarding ainda.
                      </td>
                    </tr>
                  ) : (
                    visits.map((v) => (
                      <tr key={v.id} className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/30">
                        <td className="px-3 py-2">{v.user.name}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{v.user.email}</td>
                        <td className="px-3 py-2">{v.role}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(v.firstSeenAt).toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(v.lastSeenAt).toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 tabular-nums">{v.viewCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
