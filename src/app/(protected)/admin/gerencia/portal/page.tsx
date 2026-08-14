"use client";

import { Inbox, MessageSquare, Sparkles, Truck } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import {
  GERENCIA_UPLOAD_SIGNATURE,
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";
import { employeePositionText, type EmployeeView } from "@/lib/employees";

type TabId = "notas" | "mensagens" | "limpeza" | "motorista";

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
  bankMismatch?: boolean;
  bankMismatchDetails?: string | null;
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

type CleaningReport = {
  id: string;
  employeeName: string;
  employeePosition: string;
  notes: string | null;
  status: "PENDENTE" | "VISTO";
  reviewNotes: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    itemName: string;
    kind: "DISPONIVEL" | "FALTANDO";
    quantity: number;
  }>;
};

type DriverLog = {
  id: string;
  employeeName: string;
  employeePosition: string;
  kind: "QUILOMETRAGEM" | "NOTA_SERVICO" | "OCORRENCIA";
  occurredAt: string;
  odometerKm: number | null;
  description: string;
  amountLabel: string | null;
  amountCents: number | null;
  supplier: string | null;
  fileUrl: string | null;
  fileName: string | null;
  status: "PENDENTE" | "VISTO";
  reviewNotes: string | null;
  financialEntryId: string | null;
  createdAt: string;
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

const DRIVER_KIND_LABEL: Record<DriverLog["kind"], string> = {
  QUILOMETRAGEM: "Quilometragem",
  NOTA_SERVICO: "Nota de serviço",
  OCORRENCIA: "Ocorrência",
};

function parseBankMismatchDetails(raw: string | null): { mismatches?: string[] } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { mismatches?: string[] };
    return parsed;
  } catch {
    return { mismatches: [raw] };
  }
}

function parseTab(raw: string | null): TabId {
  if (raw === "mensagens" || raw === "limpeza" || raw === "motorista") return raw;
  return "notas";
}

function GerenciaPortalPageInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialTab = parseTab(searchParams.get("tab"));
  const initialThread = searchParams.get("thread");

  const [tab, setTab] = useState<TabId>(initialTab);
  const [summary, setSummary] = useState({
    pendingInvoices: 0,
    unreadThreads: 0,
    openThreads: 0,
    pendingCleaning: 0,
    pendingDriver: 0,
    overdueMonthly: 0,
  });
  const [statusFilter, setStatusFilter] = useState<"PENDENTE" | "TODAS">("PENDENTE");
  const [employees, setEmployees] = useState<EmployeeView[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerSaving, setRegisterSaving] = useState(false);
  const [registerUploading, setRegisterUploading] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    employeeId: "",
    referenceMonth: new Date().toISOString().slice(0, 7),
    amount: "",
    description: "",
    supplier: "",
    invoiceNumber: "",
    fileUrl: "",
    filePublicId: "",
    fileName: "",
    autoApprove: true,
  });
  const registerFileRef = useRef<HTMLInputElement>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [cleaningReports, setCleaningReports] = useState<CleaningReport[]>([]);
  const [driverLogs, setDriverLogs] = useState<DriverLog[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThread);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/admin/gerencia/portal", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<typeof summary>;
    if (res.ok && json.ok) {
      setSummary(json.data);
      return;
    }
    toast.push("error", !json.ok ? json.error.message : "Falha ao carregar resumo do portal.");
  }, [toast]);

  const loadNotas = useCallback(async () => {
    const q = statusFilter === "PENDENTE" ? "?status=PENDENTE" : "";
    const res = await fetch(`/api/admin/gerencia/portal/notas${q}`, { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{
      submissions: Submission[];
      overdueMonthly?: number;
    }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao carregar as notas.");
      return;
    }
    setSubmissions(json.data.submissions);
    if (typeof json.data.overdueMonthly === "number") {
      setSummary((prev) => ({ ...prev, overdueMonthly: json.data.overdueMonthly ?? prev.overdueMonthly }));
    }
  }, [statusFilter, toast]);

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/admin/gerencia/colaboradores", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ employees: EmployeeView[] }>;
    if (res.ok && json.ok) {
      setEmployees(json.data.employees.filter((e) => e.status === "ATIVO"));
    }
  }, []);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/admin/gerencia/portal/mensagens", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ threads: ThreadItem[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao carregar as mensagens.");
      return;
    }
    setThreads(json.data.threads);
  }, [toast]);

  const loadCleaning = useCallback(async () => {
    const q = statusFilter === "PENDENTE" ? "?status=PENDENTE" : "";
    const res = await fetch(`/api/admin/gerencia/portal/limpeza${q}`, { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ reports: CleaningReport[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao carregar relatos de limpeza.");
      return;
    }
    setCleaningReports(json.data.reports);
  }, [statusFilter, toast]);

  const loadDriver = useCallback(async () => {
    const q = statusFilter === "PENDENTE" ? "?status=PENDENTE" : "";
    const res = await fetch(`/api/admin/gerencia/portal/motorista${q}`, { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ logs: DriverLog[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao carregar registros do motorista.");
      return;
    }
    setDriverLogs(json.data.logs);
  }, [statusFilter, toast]);

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
    const loadTab =
      tab === "notas"
        ? loadNotas()
        : tab === "mensagens"
          ? loadThreads()
          : tab === "limpeza"
            ? loadCleaning()
            : loadDriver();
    Promise.all([loadSummary(), loadTab])
      .catch(() => toast.push("error", "Falha ao carregar a fila."))
      .finally(() => setLoading(false));
  }, [loadCleaning, loadDriver, loadNotas, loadSummary, loadThreads, tab, toast]);

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

  async function reviewCleaning(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gerencia/portal/limpeza/${id}/revisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes: reviewNotes[id] || null }),
      });
      const json = (await res.json()) as ApiResponse<{ report: CleaningReport }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao marcar como visto.");
        return;
      }
      toast.push("success", "Relato marcado como visto.");
      void loadCleaning();
      void loadSummary();
    } catch {
      toast.push("error", "Falha ao marcar como visto.");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewDriver(id: string, createFinancialEntry: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gerencia/portal/motorista/${id}/revisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewNotes: reviewNotes[id] || null,
          createFinancialEntry,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ log: DriverLog }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao marcar como visto.");
        return;
      }
      toast.push(
        "success",
        createFinancialEntry ? "Registro visto e lançado no financeiro." : "Registro marcado como visto.",
      );
      void loadDriver();
      void loadSummary();
    } catch {
      toast.push("error", "Falha ao marcar como visto.");
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
    toast.push("success", status === "ENCERRADA" ? "Conversa encerrada." : "Conversa reaberta.");
    void loadThreads();
  }

  async function openRegisterNf() {
    await loadEmployees();
    const res = await fetch("/api/admin/gerencia/colaboradores", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ employees: EmployeeView[] }>;
    const list = res.ok && json.ok ? json.data.employees.filter((e) => e.status === "ATIVO") : [];
    setEmployees(list);
    setRegisterForm({
      employeeId: list[0]?.id ?? "",
      referenceMonth: new Date().toISOString().slice(0, 7),
      amount: "",
      description: "",
      supplier: "",
      invoiceNumber: "",
      fileUrl: "",
      filePublicId: "",
      fileName: "",
      autoApprove: true,
    });
    setRegisterOpen(true);
  }

  async function uploadRegisterFile(file: File) {
    setRegisterUploading(true);
    try {
      const signRes = await fetch(GERENCIA_UPLOAD_SIGNATURE, { method: "POST" });
      const signJson = await readApiJson<{ uploadUrl: string; apiKey: string }>(signRes);
      if (!signRes.ok || !signJson.ok) {
        toast.push("error", !signJson.ok ? signJson.error.message : "Falha ao preparar upload.");
        return;
      }
      const uploadRes = await fetch(signJson.data.uploadUrl, {
        method: "POST",
        headers: apimagesUploadHeaders(signJson.data.apiKey),
        body: buildApimagesUploadFormData(file),
      });
      const cloud = parseApimagesUploadJson(await uploadRes.json());
      if (!uploadRes.ok || !cloud.url) {
        toast.push("error", cloud.errorMessage ?? "Falha no upload.");
        return;
      }
      setRegisterForm((prev) => ({
        ...prev,
        fileUrl: cloud.url!,
        filePublicId: cloud.publicId,
        fileName: cloud.originalFilename ?? file.name,
      }));
      toast.push("success", "Arquivo anexado.");
    } catch {
      toast.push("error", "Falha ao anexar arquivo.");
    } finally {
      setRegisterUploading(false);
    }
  }

  async function submitRegisterNf() {
    if (!registerForm.employeeId) {
      toast.push("error", "Selecione o colaborador.");
      return;
    }
    if (!registerForm.fileUrl) {
      toast.push("error", "Anexe o arquivo da NF.");
      return;
    }
    setRegisterSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/portal/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: registerForm.employeeId,
          referenceMonth: registerForm.referenceMonth,
          amount: registerForm.amount || null,
          description: registerForm.description || null,
          supplier: registerForm.supplier || null,
          invoiceNumber: registerForm.invoiceNumber || null,
          fileUrl: registerForm.fileUrl,
          filePublicId: registerForm.filePublicId || null,
          fileName: registerForm.fileName || null,
          autoApprove: registerForm.autoApprove,
          createFinancialEntry: registerForm.autoApprove,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ submission: Submission }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao registrar a nota.");
        return;
      }
      toast.push(
        "success",
        registerForm.autoApprove ? "NF registrada e aprovada." : "NF enviada para a fila.",
      );
      setRegisterOpen(false);
      void loadNotas();
      void loadSummary();
    } catch {
      toast.push("error", "Falha ao registrar a nota.");
    } finally {
      setRegisterSaving(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Portal do colaborador"
        description="Fila de notas fiscais (prazo: fim do mês), mensagens, limpeza e motorista. A gerência também pode registrar NF."
        rightSlot={
          tab === "notas" ? (
            <Button onClick={openRegisterNf}>Registrar NF</Button>
          ) : null
        }
      />

      {summary.overdueMonthly > 0 ? (
        <SectionCard title="Alertas de prazo" variant="elevated">
          <p className="text-sm text-[var(--text-muted)]">
            <Badge tone="red">{summary.overdueMonthly}</Badge>{" "}
            competência(s) com NF atrasada (mês anterior sem envio/aprovação).
          </p>
        </SectionCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Notas pendentes" value={summary.pendingInvoices} icon={Inbox} accent="amber" />
        <StatTile label="NFs atrasadas" value={summary.overdueMonthly} icon={Inbox} accent="rose" />
        <StatTile label="Mensagens não lidas" value={summary.unreadThreads} icon={MessageSquare} />
        <StatTile label="Limpeza pendente" value={summary.pendingCleaning} icon={Sparkles} accent="amber" />
        <StatTile label="Motorista pendente" value={summary.pendingDriver} icon={Truck} accent="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
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
        <Button
          type="button"
          variant={tab === "limpeza" ? "primary" : "secondary"}
          onClick={() => setTab("limpeza")}
        >
          Limpeza {summary.pendingCleaning > 0 ? `(${summary.pendingCleaning})` : ""}
        </Button>
        <Button
          type="button"
          variant={tab === "motorista" ? "primary" : "secondary"}
          onClick={() => setTab("motorista")}
        >
          Motorista {summary.pendingDriver > 0 ? `(${summary.pendingDriver})` : ""}
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
                {submissions.map((s) => {
                  const mismatch = parseBankMismatchDetails(
                    s.bankMismatch ? (s.bankMismatchDetails ?? null) : null,
                  );
                  return (
                  <tr key={s.id} className={s.bankMismatch ? "bg-amber-50/80 dark:bg-amber-950/25" : undefined}>
                    <Td>
                      <div className="font-medium">{s.employeeName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{s.employeePosition}</div>
                      {s.supplier ? (
                        <div className="text-xs text-[var(--text-muted)]">{s.supplier}</div>
                      ) : null}
                      {s.bankMismatch ? (
                        <div className="mt-1.5 space-y-1">
                          <Badge tone="amber">Divergência bancária</Badge>
                          {mismatch?.mismatches?.length ? (
                            <ul className="list-inside list-disc text-xs text-amber-900 dark:text-amber-100">
                              {mismatch.mismatches.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
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
                  );
                })}
              </tbody>
            </Table>
          )}
        </SectionCard>
      ) : null}

      {tab === "mensagens" ? (
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
      ) : null}

      {tab === "limpeza" ? (
        <SectionCard title="Relatos de limpeza" variant="elevated">
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
          ) : cleaningReports.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum relato nesta fila.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Itens</Th>
                  <Th>Status</Th>
                  <Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {cleaningReports.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <div className="font-medium">{r.employeeName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.employeePosition}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {new Date(r.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </Td>
                    <Td>
                      <ul className="space-y-1 text-sm">
                        {r.lines.map((line) => (
                          <li key={line.id}>
                            {line.itemName} · {line.quantity} ·{" "}
                            {line.kind === "FALTANDO" ? "faltando" : "disponível"}
                          </li>
                        ))}
                      </ul>
                      {r.notes ? <p className="mt-1 text-xs text-[var(--text-muted)]">{r.notes}</p> : null}
                    </Td>
                    <Td>
                      <Badge tone={r.status === "PENDENTE" ? "amber" : "green"}>
                        {r.status === "PENDENTE" ? "Pendente" : "Visto"}
                      </Badge>
                    </Td>
                    <Td>
                      {r.status === "PENDENTE" ? (
                        <div className="flex min-w-[200px] flex-col gap-2">
                          <textarea
                            className="w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1 text-xs"
                            rows={2}
                            placeholder="Observação (opcional)"
                            value={reviewNotes[r.id] ?? ""}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyId === r.id}
                            onClick={() => void reviewCleaning(r.id)}
                          >
                            Marcar visto
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{r.reviewNotes || "—"}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      ) : null}

      {tab === "motorista" ? (
        <SectionCard title="Registros do motorista" variant="elevated">
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
          ) : driverLogs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum registro nesta fila.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Tipo</Th>
                  <Th>Detalhes</Th>
                  <Th>Status</Th>
                  <Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {driverLogs.map((log) => (
                  <tr key={log.id}>
                    <Td>
                      <div className="font-medium">{log.employeeName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{log.employeePosition}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {log.occurredAt.split("-").reverse().join("/")}
                      </div>
                    </Td>
                    <Td>{DRIVER_KIND_LABEL[log.kind]}</Td>
                    <Td>
                      <div className="text-sm">{log.description}</div>
                      {log.odometerKm != null ? (
                        <div className="text-xs text-[var(--text-muted)]">{log.odometerKm} km</div>
                      ) : null}
                      {log.amountLabel ? (
                        <div className="text-xs text-[var(--text-muted)]">{log.amountLabel}</div>
                      ) : null}
                      {log.fileUrl ? (
                        <a
                          href={log.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--igh-primary)] underline"
                        >
                          {log.fileName || "Arquivo"}
                        </a>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={log.status === "PENDENTE" ? "amber" : "green"}>
                        {log.status === "PENDENTE" ? "Pendente" : "Visto"}
                      </Badge>
                      {log.financialEntryId ? (
                        <div className="mt-1 text-xs text-[var(--text-muted)]">Lançado no financeiro</div>
                      ) : null}
                    </Td>
                    <Td>
                      {log.status === "PENDENTE" ? (
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <textarea
                            className="w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1 text-xs"
                            rows={2}
                            placeholder="Observação (opcional)"
                            value={reviewNotes[log.id] ?? ""}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [log.id]: e.target.value }))}
                          />
                          <div className="flex flex-wrap gap-1">
                            {log.kind === "NOTA_SERVICO" && (log.amountCents ?? 0) > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyId === log.id}
                                onClick={() => void reviewDriver(log.id, true)}
                              >
                                Aprovar e lançar
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busyId === log.id}
                              onClick={() => void reviewDriver(log.id, false)}
                            >
                              Marcar visto
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{log.reviewNotes || "—"}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      ) : null}

      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Registrar nota fiscal"
        size="large"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Use quando o colaborador entregou a NF fora do portal. O registro entra na mesma fila e
            pode ser aprovado na hora.
          </p>
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Colaborador</span>
            <select
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
              value={registerForm.employeeId}
              onChange={(e) => setRegisterForm((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">Selecione</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {employeePositionText(e)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Competência</span>
              <Input
                className="mt-1"
                type="month"
                value={registerForm.referenceMonth}
                onChange={(e) => setRegisterForm((f) => ({ ...f, referenceMonth: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Valor (R$)</span>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={registerForm.amount}
                onChange={(e) => setRegisterForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Fornecedor / MEI</span>
              <Input
                className="mt-1"
                value={registerForm.supplier}
                onChange={(e) => setRegisterForm((f) => ({ ...f, supplier: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Nº da nota</span>
              <Input
                className="mt-1"
                value={registerForm.invoiceNumber}
                onChange={(e) => setRegisterForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">Descrição</span>
              <Input
                className="mt-1"
                value={registerForm.description}
                onChange={(e) => setRegisterForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={registerUploading}
              onClick={() => registerFileRef.current?.click()}
            >
              {registerUploading ? "Enviando…" : registerForm.fileUrl ? "Trocar arquivo" : "Anexar PDF/imagem"}
            </Button>
            {registerForm.fileName ? (
              <span className="text-sm text-[var(--text-muted)]">{registerForm.fileName}</span>
            ) : null}
            <input
              ref={registerFileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadRegisterFile(file);
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={registerForm.autoApprove}
              onChange={(e) => setRegisterForm((f) => ({ ...f, autoApprove: e.target.checked }))}
            />
            Aprovar agora (marca como entregue e pode lançar no financeiro)
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
            <Button variant="secondary" onClick={() => setRegisterOpen(false)} disabled={registerSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void submitRegisterNf()} disabled={registerSaving || registerUploading}>
              {registerSaving ? "Salvando…" : "Registrar"}
            </Button>
          </div>
        </div>
      </Modal>
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
