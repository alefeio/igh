"use client";

import { useEffect, useState } from "react";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { isVideoUrl } from "@/lib/media-url";
import type { ApiResponse } from "@/lib/api-types";

type PendingFieldChange = {
  field: string;
  before: unknown;
  after: unknown;
};

type PendingItem = {
  id: string;
  entityType: string;
  action: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  previous: Record<string, unknown> | null;
  changes: PendingFieldChange[];
  createdAt: string;
  requestedBy: { id: string; name: string; email: string };
};

const ENTITY_LABELS: Record<string, string> = {
  site_settings: "Configurações",
  site_about: "Sobre",
  site_menu: "Menu (ordem)",
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
  site_formacoes_page: "Página de formações",
  site_inscreva_page: "Página Inscreva-se",
  site_contato_page: "Página de contato",
  site_espaco_maker_page: "Página Espaço Maker",
  site_unit: "Unidade",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  update: "Atualizar",
  delete: "Excluir",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  content: "Conteúdo",
  imageUrl: "Imagem",
  headerImageUrl: "Imagem do cabeçalho",
  mediaUrls: "Carrossel (mídias)",
  label: "Label",
  href: "Link",
  order: "Ordem",
  parentId: "Item pai",
  isExternal: "Link externo",
  isVisible: "Visível",
  isActive: "Ativo",
  isPublished: "Publicado",
  name: "Nome",
  slug: "Slug",
  summary: "Resumo",
  coverImageUrl: "Imagem de capa",
  galleryImages: "Galeria",
  ctaLabel: "Texto do botão",
  ctaHref: "Link do botão",
  roleOrContext: "Cargo / contexto",
  quote: "Depoimento",
  photoUrl: "Foto",
  logoUrl: "Logo",
  websiteUrl: "Site",
  excerpt: "Resumo",
  imageUrls: "Imagens",
  categoryId: "Categoria",
  publishedAt: "Data de publicação",
  question: "Pergunta",
  answer: "Resposta",
  description: "Descrição",
  date: "Data",
  fileUrl: "Arquivo",
  audience: "Público",
  outcomes: "Resultados",
  finalProject: "Projeto final",
  prerequisites: "Pré-requisitos",
  courseIds: "Cursos vinculados",
  ids: "Ordem dos itens",
  siteName: "Nome do site",
  faviconUrl: "Favicon",
  primaryColor: "Cor primária",
  secondaryColor: "Cor secundária",
  contactEmail: "E-mail de contato",
  contactPhone: "Telefone",
  contactWhatsapp: "WhatsApp",
  city: "Cidade",
  state: "Estado",
  addressLine: "Endereço",
  locationName: "Local",
  whatsapp: "WhatsApp",
  heroTitle: "Título do hero",
  heroText: "Texto do hero",
  heroImageUrl: "Imagem do hero",
  benefitsTitle: "Título dos benefícios",
  benefitsText: "Texto dos benefícios",
  benefitsBullets: "Bullets de benefícios",
  benefitsImageUrl: "Imagem dos benefícios",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
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

function isProbablyUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function isHtmlContent(value: unknown): value is string {
  return typeof value === "string" && /<\/?[a-z][\s\S]*>/i.test(value);
}

function formatScalar(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "—";
    if (t.length > 280) return `${t.slice(0, 280)}…`;
    return t;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ValuePreview({ value }: { value: unknown }) {
  if (value == null || value === "") {
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[var(--text-muted)]">Lista vazia</span>;
    if (value.every((v) => typeof v === "string" && isProbablyUrl(v))) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((url) =>
            isVideoUrl(url) ? (
              <video
                key={url}
                src={url}
                className="h-16 w-24 rounded border border-[var(--card-border)] bg-black object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                key={url}
                src={url}
                alt=""
                className="h-16 w-24 rounded border border-[var(--card-border)] object-cover"
              />
            )
          )}
        </div>
      );
    }
    return (
      <ul className="list-disc space-y-1 pl-4 text-sm">
        {value.map((item, i) => (
          <li key={i}>{formatScalar(item)}</li>
        ))}
      </ul>
    );
  }

  if (isProbablyUrl(value)) {
    if (isVideoUrl(value)) {
      return (
        <video
          src={value}
          className="max-h-40 max-w-full rounded border border-[var(--card-border)] bg-black"
          controls
          muted
          playsInline
        />
      );
    }
    return (
      <div className="space-y-1">
        <img
          src={value}
          alt=""
          className="max-h-40 max-w-full rounded border border-[var(--card-border)] object-contain"
        />
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-xs text-[var(--igh-primary)] underline"
        >
          {value}
        </a>
      </div>
    );
  }

  if (isHtmlContent(value)) {
    return (
      <div
        className="prose prose-sm max-w-none rounded border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-[var(--text-secondary)]"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm text-[var(--text-secondary)]">
      {formatScalar(value)}
    </pre>
  );
}

function ChangeRows({ changes, action }: { changes: PendingFieldChange[]; action: string }) {
  if (changes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Nenhum campo detalhado disponível para esta solicitação
        {action === "update" ? " (talvez tenha sido enviada antes da melhoria de rastreio)." : "."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {changes.map((change) => (
        <div
          key={change.field}
          className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {fieldLabel(change.field)}
          </div>
          {action === "create" ? (
            <div>
              <div className="mb-1 text-xs font-medium text-green-700 dark:text-green-400">Novo valor</div>
              <ValuePreview value={change.after} />
            </div>
          ) : action === "delete" ? (
            <div>
              <div className="mb-1 text-xs font-medium text-red-700 dark:text-red-400">Será removido</div>
              <ValuePreview value={change.before} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">Antes</div>
                <ValuePreview value={change.before} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-[var(--igh-primary)]">Depois</div>
                <ValuePreview value={change.after} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AprovacoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/master/pending-site-changes");
      const json = (await res.json()) as ApiResponse<{ items: PendingItem[] }>;
      if (res.ok && json?.ok) {
        setItems(json.data.items);
        setExpandedId((prev) => {
          if (prev && json.data.items.some((i) => i.id === prev)) return prev;
          return json.data.items[0]?.id ?? null;
        });
      } else toast.push("error", "Falha ao carregar solicitações.");
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

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Master"
        title="Aprovações do site"
        description="Alterações solicitadas por usuários Admin. Revise o que mudou, aprove para aplicar no site ou rejeite para descartar."
      />

      <SectionCard
        title="Solicitações pendentes"
        description={
          loading
            ? "Carregando lista…"
            : `${items.length} ${items.length === 1 ? "item" : "itens"} na fila.`
        }
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
          <div className="space-y-4">
            {items.map((item) => {
              const open = expandedId === item.id;
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/30"
                >
                  <header className="flex flex-col gap-3 border-b border-[var(--card-border)] p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                          {ENTITY_LABELS[item.entityType] ?? item.entityType}
                        </h3>
                        <span className="rounded-full bg-[var(--igh-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--igh-primary)]">
                          {ACTION_LABELS[item.action] ?? item.action}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {item.changes.length}{" "}
                          {item.changes.length === 1 ? "campo alterado" : "campos alterados"}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Solicitado por <strong>{item.requestedBy.name}</strong> ({item.requestedBy.email})
                        {" · "}
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setExpandedId(open ? null : item.id)}
                      >
                        {open ? "Ocultar detalhes" : "Ver alterações"}
                      </Button>
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
                  </header>
                  {open && (
                    <div className="p-4">
                      <ChangeRows changes={item.changes} action={item.action} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
