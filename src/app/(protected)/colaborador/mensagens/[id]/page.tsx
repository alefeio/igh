"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type ThreadDetail = {
  id: string;
  subject: string;
  status: "ABERTA" | "ENCERRADA";
  messages: Array<{
    id: string;
    authorName: string;
    isFromManager: boolean;
    content: string;
    createdAt: string;
  }>;
};

export default function ColaboradorMensagemDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/me/colaborador/mensagens/${id}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ thread: ThreadDetail }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Conversa não encontrada.");
        return;
      }
      setThread(json.data.thread);
    } catch {
      toast.push("error", "Falha ao carregar a conversa.");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reply() {
    setSaving(true);
    try {
      const res = await fetch(`/api/me/colaborador/mensagens/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = (await res.json()) as ApiResponse<{ thread: ThreadDetail }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao responder.");
        return;
      }
      setThread(json.data.thread);
      setContent("");
    } catch {
      toast.push("error", "Falha ao responder.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Portal do colaborador"
        title={thread?.subject ?? "Conversa"}
        description={
          <Link href="/colaborador/mensagens" className="text-sm underline">
            Voltar às conversas
          </Link>
        }
        rightSlot={
          thread ? (
            <Badge tone={thread.status === "ABERTA" ? "blue" : "zinc"}>
              {thread.status === "ABERTA" ? "Aberta" : "Encerrada"}
            </Badge>
          ) : null
        }
      />

      <SectionCard title="Mensagens" variant="elevated">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : !thread ? (
          <p className="text-sm text-[var(--text-muted)]">Conversa não encontrada.</p>
        ) : (
          <div className="space-y-3">
            {thread.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border border-[var(--card-border)] px-3 py-2 ${
                  m.isFromManager ? "bg-[var(--igh-surface)]" : ""
                }`}
              >
                <p className="text-xs text-[var(--text-muted)]">
                  {m.isFromManager ? "Gerência" : m.authorName} ·{" "}
                  {new Date(m.createdAt).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{m.content}</p>
              </div>
            ))}
            {thread.status === "ABERTA" ? (
              <div className="pt-2">
                <textarea
                  className="w-full min-h-[80px] rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  placeholder="Escreva sua resposta…"
                />
                <Button className="mt-2" type="button" onClick={() => void reply()} disabled={saving || !content.trim()}>
                  {saving ? "Enviando…" : "Responder"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Esta conversa foi encerrada.</p>
            )}
          </div>
        )}
      </SectionCard>
    </PanelPageStack>
  );
}
