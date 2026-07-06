"use client";

import { Lightbulb, MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CommunityTagInput } from "@/components/community/CommunityTagInput";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import type { CommunityTopicView } from "@/lib/igh-community-types";

const KIND_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "IDEA", label: "Ideias de projeto" },
  { value: "TEAM", label: "Equipe / parceria" },
  { value: "DISCUSSION", label: "Discussão geral" },
] as const;

export function IghCommunityHub({ canCreateTopics = false }: { canCreateTopics?: boolean }) {
  const toast = useToast();
  const user = useUser();
  const isStudent = user.role === "STUDENT";

  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [topics, setTopics] = useState<CommunityTopicView[]>([]);
  const [canParticipate, setCanParticipate] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<"IDEA" | "TEAM" | "DISCUSSION">("IDEA");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const listUrl = isStudent
    ? `/api/me/igh-community/topics${kindFilter ? `?kind=${kindFilter}` : ""}${tagFilter ? `${kindFilter ? "&" : "?"}tag=${encodeURIComponent(tagFilter)}` : ""}`
    : `/api/igh-community/topics${kindFilter ? `?kind=${kindFilter}` : ""}${tagFilter ? `${kindFilter ? "&" : "?"}tag=${encodeURIComponent(tagFilter)}` : ""}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl);
      const json = (await res.json()) as ApiResponse<{
        topics: CommunityTopicView[];
        canParticipate?: boolean;
      }>;
      if (res.ok && json.ok) {
        setTopics(json.data.topics);
        setCanParticipate(json.data.canParticipate ?? true);
      } else {
        setTopics([]);
        toast.push("error", json.ok ? "Erro ao carregar." : json.error.message);
      }
    } catch {
      setTopics([]);
      toast.push("error", "Não foi possível carregar a comunidade.");
    } finally {
      setLoading(false);
    }
  }, [listUrl, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitTopic = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/me/igh-community/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: formKind, title: formTitle, content: formContent, tags: formTags }),
      });
      const json = (await res.json()) as ApiResponse<{ message?: string }>;
      if (res.ok && json.ok) {
        toast.push("success", json.data.message ?? "Publicado.");
        setShowForm(false);
        setFormTitle("");
        setFormContent("");
        setFormTags([]);
        void load();
      } else {
        toast.push("error", json.ok ? "Falha ao publicar." : json.error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const allTags = [...new Set(topics.flatMap((t) => t.tags))].sort();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm">
          <Lightbulb className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
          <span>
            <strong className="text-[var(--text-primary)]">Ideias</strong> — propostas para o PII e inovação entre cursos.
          </span>
        </div>
        <div className="flex gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm">
          <Users className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
          <span>
            <strong className="text-[var(--text-primary)]">Equipes</strong> — encontre parceiros de outros cursos e turmas.
          </span>
        </div>
        <div className="flex gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm">
          <MessageSquare className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
          <span>
            <strong className="text-[var(--text-primary)]">Debate</strong> — troque experiências com toda a comunidade IGH.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          Tipo
          <select
            className="ml-2 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {allTags.length > 0 && (
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Tag
            <select
              className="ml-2 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          </label>
        )}
        {canCreateTopics && canParticipate && (
          <Button type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "Nova publicação"}
          </Button>
        )}
        {canCreateTopics && !canParticipate && (
          <p className="text-sm text-amber-700 dark:text-amber-300">Conta inativa para publicar.</p>
        )}
      </div>

      {showForm && canCreateTopics && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Nova publicação</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Sua mensagem será publicada imediatamente para toda a comunidade.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-sm">
              Tipo
              <select
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
                value={formKind}
                onChange={(e) => setFormKind(e.target.value as typeof formKind)}
              >
                <option value="IDEA">Ideia de projeto</option>
                <option value="TEAM">Equipe / parceria</option>
                <option value="DISCUSSION">Discussão geral</option>
              </select>
            </label>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Título
              <Input
                className="mt-1"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Resumo da sua ideia ou pergunta"
              />
            </label>
            <CommunityTagInput value={formTags} onChange={setFormTags} />
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Mensagem
              <textarea
                className="mt-1 min-h-[120px] w-full rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Descreva sua ideia, o que você busca em uma equipe ou sua pergunta para a comunidade…"
              />
            </label>
            <Button type="button" disabled={saving} onClick={() => void submitTopic()}>
              {saving ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : topics.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {isStudent
            ? "Nenhuma publicação ainda. Seja o primeiro a compartilhar uma ideia!"
            : "Nenhuma publicação no momento."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {topics.map((t) => (
            <li key={t.id}>
              <Link
                href={`/comunidade/${t.id}`}
                className="block rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-surface)]/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--igh-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--igh-primary)]">
                    {t.kindLabel}
                  </span>
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <h3 className="mt-2 font-semibold text-[var(--text-primary)]">{t.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{t.content}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {t.authorName} · {t.authorRoleLabel} · {t.replyCount} resposta{t.replyCount !== 1 ? "s" : ""} ·{" "}
                  {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
