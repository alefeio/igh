"use client";

import { Inbox, MessageSquare } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type TabId = "notas" | "mensagens";

type Submission = {
  id: string;
  employeeName: string;
  employeePosition: string;
  referenceMonthLabel: string;
  amountLabel: string;
  description: string | null;
  supplier: string | null;
  invoiceNumber: string | null;
  fileUrl: string;
  fileName: string | null;
  status: "PENDENTE" | "APROVADA" | "RECUSADA";
  reviewNotes: string | null;
  financialEntryId: string | null;
  createdAt: string;
};

type ThreadItem = {
  id: string;
  employeeName: string;
  employeePosition: string;
  subject: string;
  status: "ABERTA" | "ENCERRADA";
  unread: boolean;
  lastMessage: string | null;
  lastMessageAt: string;
};

type ThreadDetail = {
  id: string;
  employeeName: string;
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

const STATUS_TONE: Record<Submission["status"], "amber" | "green" | "red"> = {
  PENDENTE: "amber",
  APROVADA: "green",
  RECUSADA: "red",
};

const STATUS_LABEL: Record<Submission["status"], string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
};

function GerenciaPortalPageInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "mensagens" ? "mensagens" : "notas";
  const initialThread = searchParams.get("thread");

  const [tab, setTab] = useState<TabId>(initialTab);
  const [summary, setSummary] = useState({ pendingInvoices: 0, unreadThreads: 0, openThreads: 0 });
  const [statusFilter, setStatusFilter] = useState<"PENDENTE" | "TODAS">("PENDENTE");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThread);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/admin/gerencia/portal", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<typeof summary>;
    if (res.ok && json.ok) setSummary(json.data);
  }, []);

  const loadNotas = useCallback(async () => {
    const q = statusFilter === "PENDENTE" ? "?status=PENDENTE" : "";
    const res = await fetch(`/api/admin/gerencia/portal/notas${q}`, { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ submissions: Submission[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao carregar as notas.");
      return;
    }
    setSubmissions(json.data.submissions);
  }, [statusFilter, toast]);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/admin/gerencia/portal/mensagens", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ threads: ThreadItem[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao carregar as mensagens.");
      return;
    }
    setThreads(json.data.threads);
  }, [toast]);

  const loadThread = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/gerencia/portal/mensagens/${id}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ thread: ThreadDetail }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Conversa não encontrada.");
        return;
      }
      setThread(json.data.thread);
      void loadThreads();
      void loadSummary();
    },
    [loadSummary, loadThreads, toast],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), tab === "notas" ? loadNotas() : loadThreads()])
      .catch(() => toast.push("error", "Falha ao carregar a fila."))
      .finally(() => setLoading(false));
  }, [loadNotas, loadSummary, loadThreads, tab, toast]);

  useEffect(() => {
    if (tab === "mensagens" && activeThreadId) void loadThread(activeThreadId);
  }, [activeThreadId, loadThread, tab]);

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === "PENDENTE").length,
    [submissions],
  );

  async function review(id: string, action: "APROVAR" | "RECUSAR", createFinancialEntry: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gerencia/portal/notas/${id}/revisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewNotes: reviewNotes[id] || null,
          createFinancialEntry,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ submission: Submission }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao revisar.");
        return;
      }
      toast.push("success", action === "APROVAR" ? "Nota aprovada." : "Nota recusada.");
      void loadNotas();
      void loadSummary();
    } catch {
      toast.push("error", "Falha ao revisar.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendReply() {
    if (!activeThreadId || !reply.trim()) return;
    setBusyId(activeThreadId);
    try {
      const res = await fetch(`/api/admin/gerencia/portal/mensagens/${activeThreadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply }),
      });
      const json = (await res.json()) as ApiResponse<{ thread: ThreadDetail }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao responder.");
        return;
      }
      setThread(json.data.thread);
      setReply("");
      void loadThreads();
    } catch {
      toast.push("error", "Falha ao responder.");
    } finally {
      setBusyId(null);
    }
  }

  async function closeThread(status: "ABERTA" | "ENCERRADA") {
    if (!activeThreadId) return;
    const res = await fetch(`/api/admin/gerencia/portal/mensagens/${activeThreadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = (await res.json()) as ApiResponse<{ thread: ThreadDetail }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar.");
      return;
    }
    setThread(json.data.thread);
    void loadThreads();
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Portal do colaborador"
        description="Fila de notas fiscais e mensagens enviadas pelos colaboradores."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Notas pendentes" value={summary.pendingInvoices} icon={Inbox} accent="amber" />
        <StatTile label="Mensagens não lidas" value={summary.unreadThreads} icon={MessageSquare} />
        <StatTile label="Conversas abertas" value={summary.openThreads} icon={MessageSquare} accent="emerald" />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={tab === "notas" ? "primary" : "secondary"} onClick={() => setTab("notas")}>
          Notas {summary.pendingInvoices > 0 ? `(${summary.pendingInvoices})` : ""}
        </Button>
        <Button
          type="button"
          variant={tab === "mensagens" ? "primary" : "secondary"}
          onClick={() => setTab("mensagens")}
        >
          Mensagens {summary.unreadThreads > 0 ? `(${summary.unreadThreads})` : ""}
        </Button>
      </div>

      {tab === "notas" ? (
        <SectionCard
          title="Notas enviadas"
          description={statusFilter === "PENDENTE" ? `${pendingCount} aguardando revisão` : "Histórico completo"}
          variant="elevated"
        >
          <div className="mb-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "PENDENTE" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("PENDENTE")}
            >
              Pendentes
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "TODAS" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("TODAS")}
            >
              Todas
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma nota nesta fila.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Competência</Th>
                  <Th>Valor</Th>
                  <Th>Arquivo</Th>
                  <Th>Status</Th>
                  <Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <div className="font-medium">{s.employeeName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{s.employeePosition}</div>
                      {s.supplier ? (
                        <div className="text-xs text-[var(--text-muted)]">{s.supplier}</div>
                      ) : null}
                    </Td>
                    <Td>{s.referenceMonthLabel}</Td>
                    <Td>{s.amountLabel}</Td>
                    <Td>
                      <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-[var(--igh-primary)] underline">
                        {s.fileName || "Abrir"}
                      </a>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                      {s.financialEntryId ? (
                        <div className="mt-1 text-xs text-[var(--text-muted)]">Lançada no financeiro</div>
                      ) : null}
                    </Td>
                    <Td>
                      {s.status === "PENDENTE" ? (
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <textarea
                            className="w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1 text-xs"
                            rows={2}
                            placeholder="Observação (opcional)"
                            value={reviewNotes[s.id] ?? ""}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          />
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyId === s.id}
                              onClick={() => void review(s.id, "APROVAR", true)}
                            >
                              Aprovar e lançar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busyId === s.id}
                              onClick={() => void review(s.id, "APROVAR", false)}
                            >
                              Só aprovar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="text-red-600"
                              disabled={busyId === s.id}
                              onClick={() => void review(s.id, "RECUSAR", false)}
                            >
                              Recusar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{s.reviewNotes || "—"}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <SectionCard title="Conversas" variant="elevated">
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : threads.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhuma mensagem.</p>
            ) : (
              <ul className="divide-y divide-[var(--card-border)]">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`w-full px-1 py-3 text-left ${
                        activeThreadId === t.id ? "bg-[var(--igh-surface)]" : ""
                      }`}
                      onClick={() => setActiveThreadId(t.id)}
                    >
                      <p className="font-medium">
                        {t.unread ? "● " : ""}
                        {t.employeeName}
                      </p>
                      <p className="text-sm text-[var(--text-primary)]">{t.subject}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{t.lastMessage}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title={thread?.subject ?? "Selecione uma conversa"} variant="elevated">
            {!thread ? (
              <p className="text-sm text-[var(--text-muted)]">Escolha uma conversa à esquerda.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[var(--text-muted)]">{thread.employeeName}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void closeThread(thread.status === "ABERTA" ? "ENCERRADA" : "ABERTA")}
                  >
                    {thread.status === "ABERTA" ? "Encerrar" : "Reabrir"}
                  </Button>
                </div>
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
                    <p className="mt-1 whitespace-pre-wrap text-sm">{m.content}</p>
                  </div>
                ))}
                <textarea
                  className="w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder ao colaborador…"
                />
                <Button type="button" onClick={() => void sendReply()} disabled={!reply.trim() || busyId === activeThreadId}>
                  Enviar resposta
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </PanelPageStack>
  );
}

export default function GerenciaPortalPage() {
  return (
    <Suspense fallback={<PanelPageStack><p className="text-sm text-[var(--text-muted)]">Carregando…</p></PanelPageStack>}>
      <GerenciaPortalPageInner />
    </Suspense>
  );
}
