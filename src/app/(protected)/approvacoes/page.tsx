"use client";

import { useEffect, useState } from "react";
import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type PendingItem = {
  id: string;
  entityType: string;
  action: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  requestedBy: { id: string; name: string; email: string };
};

const ENTITY_LABELS: Record<string, string> = {
  site_settings: "Configurações",
  site_about: "Sobre",
  site_menu: "Menu",
  site_menu_item: "Item do menu",
  site_banner: "Banner",
  site_project: "Projeto",
  site_project_reorder: "Ordem dos projetos",
  site_testimonial: "Depoimento",
  site_partner: "Parceiro",
  site_news_category: "Categoria (Notícias)",
  site_news_post: "Post (Notícias)",
  site_faq_item: "Item FAQ",
  site_transparency_category: "Categoria (Transparência)",
  site_transparency_document: "Documento (Transparência)",
  site_formation: "Formação",
  site_formation_courses: "Cursos da formação",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  update: "Atualizar",
};

export default function AprovacoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/master/pending-site-changes");
      const json = (await res.json()) as ApiResponse<{ items: PendingItem[] }>;
      if (res.ok && json?.ok) setItems(json.data.items);
      else toast.push("error", "Falha ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/master/pending-site-changes/${id}/approve`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ approved: boolean }>;
      if (res.ok && json?.ok) {
        toast.push("success", "Alteração aprovada e aplicada.");
        void load();
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Falha ao aprovar.");
      }
    } finally {
      setActingId(null);
    }
  }

  async function reject(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/master/pending-site-changes/${id}/reject`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ rejected: boolean }>;
      if (res.ok && json?.ok) {
        toast.push("success", "Solicitação rejeitada.");
        void load();
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Falha ao rejeitar.");
      }
    } finally {
      setActingId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Master"
        title="Aprovações do site"
        description="Alterações solicitadas por usuários Admin. Aprove para aplicar no site ou rejeite para descartar."
      />

      <SectionCard
        title="Solicitações pendentes"
        description={loading ? "Carregando lista…" : `${items.length} ${items.length === 1 ? "item" : "itens"} na fila.`}
        variant="elevated"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14" role="status">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/40 px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            Nenhuma solicitação pendente.
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Seção</Th>
                <Th>Ação</Th>
                <Th>Solicitante</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <Td>{formatDate(item.createdAt)}</Td>
                  <Td>{ENTITY_LABELS[item.entityType] ?? item.entityType}</Td>
                  <Td>{ACTION_LABELS[item.action] ?? item.action}</Td>
                  <Td>
                    <div className="font-medium text-[var(--text-primary)]">{item.requestedBy.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{item.requestedBy.email}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={actingId !== null}
                        onClick={() => approve(item.id)}
                      >
                        {actingId === item.id ? "Aprovando..." : "Aprovar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actingId !== null}
                        className="text-red-600"
                        onClick={() => reject(item.id)}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </SectionCard>
    </div>
  );
}
