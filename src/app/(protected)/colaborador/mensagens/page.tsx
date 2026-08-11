"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

type ThreadItem = {
  id: string;
  subject: string;
  status: "ABERTA" | "ENCERRADA";
  unread: boolean;
  lastMessage: string | null;
  lastMessageAt: string;
};

export default function ColaboradorMensagensPage() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/colaborador/mensagens", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ threads: ThreadItem[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar as mensagens.");
        return;
      }
      setThreads(json.data.threads);
    } catch {
      toast.push("error", "Falha ao carregar as mensagens.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createThread() {
    setSaving(true);
    try {
      const res = await fetch("/api/me/colaborador/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, content }),
      });
      const json = (await res.json()) as ApiResponse<{ id: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao enviar.");
        return;
      }
      toast.push("success", "Mensagem enviada à gerência.");
      router.push(`/colaborador/mensagens/${json.data.id}`);
    } catch {
      toast.push("error", "Falha ao enviar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Portal do colaborador"
        title="Falar com a gerência"
        description="Canal interno da Gerência Administrativa — não substitui o relatório à coordenação pedagógica."
      />

      <SectionCard title="Nova mensagem" variant="elevated">
        <div className="grid gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Assunto</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Mensagem</span>
            <textarea
              className="mt-1 w-full min-h-[96px] rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </label>
          <div>
            <Button type="button" onClick={() => void createThread()} disabled={saving}>
              {saving ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Conversas" variant="elevated">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : threads.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma conversa ainda.</p>
        ) : (
          <ul className="divide-y divide-[var(--card-border)]">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/colaborador/mensagens/${t.id}`}
                  className="flex items-start justify-between gap-3 py-3 hover:bg-[var(--igh-surface)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--text-primary)]">
                      {t.unread ? "● " : ""}
                      {t.subject}
                    </p>
                    <p className="truncate text-sm text-[var(--text-muted)]">{t.lastMessage}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={t.status === "ABERTA" ? "blue" : "zinc"}>
                      {t.status === "ABERTA" ? "Aberta" : "Encerrada"}
                    </Badge>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {new Date(t.lastMessageAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PanelPageStack>
  );
}
