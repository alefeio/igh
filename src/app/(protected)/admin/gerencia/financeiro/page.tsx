"use client";

import * as XLSX from "xlsx";
import { ArrowDownCircle, ArrowUpCircle, Plus, Scale, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import {
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  GERENCIA_UPLOAD_SIGNATURE,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";
import { formatCentsBRL, formatReferenceMonth } from "@/lib/employees";
import {
  FINANCIAL_ENTRY_KIND_LABEL,
  FINANCIAL_ENTRY_KINDS,
  FINANCIAL_PAYMENT_METHOD_LABEL,
  FINANCIAL_PAYMENT_METHODS,
  FINANCIAL_PAYMENT_STATUS_LABEL,
  FINANCIAL_PAYMENT_STATUSES,
  formatEntryDate,
  paymentStatusBadgeTone,
  responsibleLabel,
  type FinancialCategoryView,
  type FinancialEntryView,
} from "@/lib/financeiro";
import { brazilTodayIsoDate, isPastDueDate } from "@/lib/financeiro-payment-shared";
import type {
  FinancialEntryKind,
  FinancialPaymentMethod,
  FinancialPaymentStatus,
} from "@/generated/prisma/client";

type PoloOption = { id: string; name: string };
type UserOption = { id: string; name: string; email: string };
type Totals = { entradasCents: number; saidasCents: number; saldoCents: number };
type PaymentAlerts = {
  dueSoonCount: number;
  dueTodayCount: number;
  overdueCount: number;
  dueSoonDays: number;
};

type TabId = "fluxo" | "notas-mei" | "prestacao";

type InvoiceSuggestion = {
  amount?: string;
  supplier?: string;
  description?: string;
  invoiceNumber?: string;
  entryDate?: string;
  categoryName?: string;
};

type MeiInvoice = {
  id: string;
  employeeId: string;
  referenceMonth: string;
  amountCents: number | null;
  status: string;
  pdfUrl: string | null;
  pdfPublicId: string | null;
  notes: string | null;
  employee?: {
    id: string;
    name: string;
    cpf: string;
    employmentType?: string;
  } | null;
};

type EntryForm = {
  kind: FinancialEntryKind;
  description: string;
  amount: string;
  entryDate: string;
  /** Só para conta com vencimento já passado no cadastro novo. */
  alreadyPaid: boolean;
  paymentStatus: FinancialPaymentStatus;
  categoryId: string;
  paymentMethod: FinancialPaymentMethod;
  poloId: string;
  responsibleUserId: string;
  responsibleName: string;
  invoiceNumber: string;
  supplier: string;
  notes: string;
  attachmentUrl: string;
  attachmentPublicId: string;
  attachmentFileName: string;
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  ENTREGUE: "Entregue",
  ATRASADA: "Atrasada",
};

function emptyForm(): EntryForm {
  return {
    kind: "SAIDA",
    description: "",
    amount: "",
    entryDate: brazilTodayIsoDate(),
    alreadyPaid: false,
    paymentStatus: "EM_ABERTO",
    categoryId: "",
    paymentMethod: "PIX",
    poloId: "",
    responsibleUserId: "",
    responsibleName: "",
    invoiceNumber: "",
    supplier: "",
    notes: "",
    attachmentUrl: "",
    attachmentPublicId: "",
    attachmentFileName: "",
  };
}

function suggestionHasAny(s: InvoiceSuggestion | null) {
  if (!s) return false;
  return Boolean(s.amount || s.supplier || s.description || s.invoiceNumber || s.entryDate);
}

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

export default function FinanceiroPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("fluxo");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<FinancialEntryView[]>([]);
  const [totals, setTotals] = useState<Totals>({ entradasCents: 0, saidasCents: 0, saldoCents: 0 });
  const [alerts, setAlerts] = useState<PaymentAlerts>({
    dueSoonCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    dueSoonDays: 7,
  });
  const [categories, setCategories] = useState<FinancialCategoryView[]>([]);
  const [polos, setPolos] = useState<PoloOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [kindFilter, setKindFilter] = useState<"" | FinancialEntryKind>("");
  const [statusFilter, setStatusFilter] = useState<"" | FinancialPaymentStatus>("");
  const [dueAlertFilter, setDueAlertFilter] = useState<"" | "today" | "soon" | "overdue" | "attention">(
    "",
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [poloFilter, setPoloFilter] = useState("");
  const [q, setQ] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntryView | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readingInvoice, setReadingInvoice] = useState(false);
  const [suggestion, setSuggestion] = useState<InvoiceSuggestion | null>(null);
  const [suggestionWarnings, setSuggestionWarnings] = useState<string[]>([]);
  const [suggestionSource, setSuggestionSource] = useState<string | null>(null);
  const [suggestionCategoryId, setSuggestionCategoryId] = useState<string | null>(null);

  const [meiLoading, setMeiLoading] = useState(false);
  const [meiInvoices, setMeiInvoices] = useState<MeiInvoice[]>([]);

  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<FinancialEntryKind>("SAIDA");
  const [catSaving, setCatSaving] = useState(false);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (month) sp.set("month", month);
    if (kindFilter) sp.set("kind", kindFilter);
    if (statusFilter) sp.set("paymentStatus", statusFilter);
    if (dueAlertFilter) sp.set("dueAlert", dueAlertFilter);
    if (categoryFilter) sp.set("categoryId", categoryFilter);
    if (poloFilter) sp.set("poloId", poloFilter);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [month, kindFilter, statusFilter, dueAlertFilter, categoryFilter, poloFilter, q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, cRes, oRes] = await Promise.all([
        fetch(`/api/admin/gerencia/financeiro/lancamentos?${queryString}`, { cache: "no-store" }),
        fetch("/api/admin/gerencia/financeiro/categorias", { cache: "no-store" }),
        fetch("/api/admin/gerencia/opcoes?allStaff=true", { cache: "no-store" }),
      ]);
      const eJson = (await eRes.json()) as ApiResponse<{
        entries: FinancialEntryView[];
        totals: Totals;
        alerts?: PaymentAlerts;
      }>;
      const cJson = (await cRes.json()) as ApiResponse<{ categories: FinancialCategoryView[] }>;
      const oJson = (await oRes.json()) as ApiResponse<{ users: UserOption[]; polos: PoloOption[] }>;

      if (!eRes.ok || !eJson.ok) {
        toast.push("error", !eJson.ok ? eJson.error.message : "Falha ao carregar lançamentos.");
        return;
      }
      setEntries(eJson.data.entries);
      setTotals(eJson.data.totals);
      if (eJson.data.alerts) setAlerts(eJson.data.alerts);
      if (cRes.ok && cJson.ok) setCategories(cJson.data.categories);
      if (oRes.ok && oJson.ok) {
        setUsers(oJson.data.users);
        setPolos(oJson.data.polos);
      }
    } catch {
      toast.push("error", "Falha ao carregar financeiro.");
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  const loadMei = useCallback(async () => {
    setMeiLoading(true);
    try {
      const sp = new URLSearchParams();
      if (month) sp.set("month", month);
      sp.set("employmentType", "MEI");
      const res = await fetch(`/api/admin/gerencia/notas-mensais?${sp}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ invoices: MeiInvoice[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar notas MEI.");
        return;
      }
      setMeiInvoices(json.data.invoices);
    } catch {
      toast.push("error", "Falha ao carregar notas MEI.");
    } finally {
      setMeiLoading(false);
    }
  }, [month, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "notas-mei") void loadMei();
  }, [tab, loadMei]);

  const categoriesForForm = useMemo(
    () => categories.filter((c) => c.isActive && c.kind === form.kind),
    [categories, form.kind],
  );

  const categoriesForFilter = useMemo(
    () => categories.filter((c) => c.isActive && (!kindFilter || c.kind === kindFilter)),
    [categories, kindFilter],
  );

  function setField<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearSuggestion() {
    setSuggestion(null);
    setSuggestionWarnings([]);
    setSuggestionSource(null);
    setSuggestionCategoryId(null);
  }

  function openCreate(kind: FinancialEntryKind = "SAIDA") {
    setEditing(null);
    setForm({ ...emptyForm(), kind });
    clearSuggestion();
    setFormOpen(true);
  }

  function openEdit(entry: FinancialEntryView) {
    setEditing(entry);
    clearSuggestion();
    setForm({
      kind: entry.kind,
      description: entry.description,
      amount: (entry.amountCents / 100).toFixed(2).replace(".", ","),
      entryDate: entry.entryDate,
      alreadyPaid: entry.paymentStatus === "PAGO",
      paymentStatus: entry.paymentStatus,
      categoryId: entry.categoryId ?? "",
      paymentMethod: entry.paymentMethod,
      poloId: entry.poloId ?? "",
      responsibleUserId: entry.responsibleUserId ?? "",
      responsibleName: entry.responsibleName ?? "",
      invoiceNumber: entry.invoiceNumber ?? "",
      supplier: entry.supplier ?? "",
      notes: entry.notes ?? "",
      attachmentUrl: entry.attachmentUrl ?? "",
      attachmentPublicId: entry.attachmentPublicId ?? "",
      attachmentFileName: entry.attachmentFileName ?? "",
    });
    setFormOpen(true);
  }

  function openFromMeiInvoice(inv: MeiInvoice) {
    const nome = inv.employee?.name ?? "colaborador";
    const competencia = formatReferenceMonth(inv.referenceMonth);
    setEditing(null);
    clearSuggestion();
    setForm({
      ...emptyForm(),
      kind: "SAIDA",
      description: `Nota MEI — ${nome} — ${competencia}`,
      amount: inv.amountCents != null ? (inv.amountCents / 100).toFixed(2).replace(".", ",") : "",
      entryDate: new Date().toISOString().slice(0, 10),
      responsibleName: nome,
      supplier: nome,
      notes: inv.notes ?? "",
      attachmentUrl: inv.pdfUrl ?? "",
      attachmentPublicId: inv.pdfPublicId ?? "",
      attachmentFileName: inv.pdfUrl ? `nota-mei-${competencia.replace("/", "-")}.pdf` : "",
    });
    setTab("fluxo");
    setFormOpen(true);
    toast.push("success", "Formulário preenchido a partir da nota MEI. Revise e salve no fluxo.");
  }

  async function readInvoice(attachmentUrl: string, attachmentFileName: string) {
    setReadingInvoice(true);
    clearSuggestion();
    try {
      const res = await fetch("/api/admin/gerencia/financeiro/ler-nota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentUrl, attachmentFileName }),
      });
      const json = (await res.json()) as ApiResponse<{
        suggestion: InvoiceSuggestion;
        source: string;
        warnings: string[];
        categoryId?: string | null;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível ler a nota.");
        return;
      }
      setSuggestionWarnings(json.data.warnings ?? []);
      setSuggestionSource(json.data.source);
      setSuggestionCategoryId(json.data.categoryId ?? null);
      if (suggestionHasAny(json.data.suggestion) || json.data.categoryId) {
        setSuggestion(json.data.suggestion);
        const today = brazilTodayIsoDate();
        setForm((prev) => {
          const take = (current: string, value?: string, treatTodayAsEmpty = false) => {
            if (!value) return current;
            if (!current.trim() || (treatTodayAsEmpty && current === today)) return value;
            return current;
          };
          const categoryId =
            !prev.categoryId && json.data.categoryId ? json.data.categoryId : prev.categoryId;
          return {
            ...prev,
            kind: json.data.suggestion.categoryName ? "SAIDA" : prev.kind,
            amount: take(prev.amount, json.data.suggestion.amount),
            supplier: take(prev.supplier, json.data.suggestion.supplier),
            description: take(prev.description, json.data.suggestion.description),
            invoiceNumber: take(prev.invoiceNumber, json.data.suggestion.invoiceNumber),
            entryDate: take(prev.entryDate, json.data.suggestion.entryDate, true),
            categoryId,
          };
        });
        if (json.data.categoryId && !categories.some((c) => c.id === json.data.categoryId)) {
          void load();
        }
        toast.push("success", "Sugestões da nota aplicadas — revise antes de salvar.");
      } else {
        toast.push("error", "Nenhum dado extraído da nota. Preencha manualmente.");
      }
    } catch {
      toast.push("error", "Falha ao ler a nota.");
    } finally {
      setReadingInvoice(false);
    }
  }

  function applySuggestion(overwrite: boolean) {
    if (!suggestion) return;
    setForm((prev) => {
      const next = { ...prev };
      const today = brazilTodayIsoDate();
      const take = (current: string, value?: string, treatTodayAsEmpty = false) => {
        if (!value) return current;
        if (overwrite || !current.trim() || (treatTodayAsEmpty && current === today)) return value;
        return current;
      };
      next.amount = take(prev.amount, suggestion.amount);
      next.supplier = take(prev.supplier, suggestion.supplier);
      next.description = take(prev.description, suggestion.description);
      next.invoiceNumber = take(prev.invoiceNumber, suggestion.invoiceNumber);
      next.entryDate = take(prev.entryDate, suggestion.entryDate, true);
      if ((overwrite || !prev.categoryId) && suggestionCategoryId) {
        next.categoryId = suggestionCategoryId;
      }
      if (suggestion.categoryName) next.kind = "SAIDA";
      return next;
    });
    toast.push("success", overwrite ? "Campos atualizados com as sugestões." : "Campos vazios preenchidos.");
  }

  async function uploadAttachment(file: File) {
    setUploading(true);
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
      if (!uploadRes.ok || !cloud.url || !cloud.publicId) {
        toast.push("error", cloud.errorMessage ?? "Falha no upload.");
        return;
      }
      const fileName = cloud.originalFilename ?? file.name;
      setForm((prev) => ({
        ...prev,
        attachmentUrl: cloud.url!,
        attachmentPublicId: cloud.publicId,
        attachmentFileName: fileName,
      }));
      toast.push("success", "Anexo enviado.");
      void readInvoice(cloud.url!, fileName);
    } catch {
      toast.push("error", "Falha ao anexar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function saveEntry() {
    if (!form.description.trim() || !form.amount.trim()) {
      toast.push("error", "Informe descrição e valor.");
      return;
    }
    if (!form.responsibleUserId && !form.responsibleName.trim()) {
      toast.push("error", "Informe o responsável.");
      return;
    }
    setSaving(true);
    try {
      const pastDue = isPastDueDate(form.entryDate);
      const body = editing
        ? {
            kind: form.kind,
            description: form.description,
            amount: form.amount,
            entryDate: form.entryDate,
            paymentStatus: form.paymentStatus,
            categoryId: form.categoryId || null,
            paymentMethod: form.paymentMethod,
            poloId: form.poloId || null,
            responsibleUserId: form.responsibleUserId || null,
            responsibleName: form.responsibleName,
            invoiceNumber: form.invoiceNumber,
            supplier: form.supplier,
            notes: form.notes,
            attachmentUrl: form.attachmentUrl || null,
            attachmentPublicId: form.attachmentPublicId || null,
            attachmentFileName: form.attachmentFileName || null,
          }
        : {
            kind: form.kind,
            description: form.description,
            amount: form.amount,
            entryDate: form.entryDate,
            alreadyPaid: pastDue ? form.alreadyPaid : null,
            categoryId: form.categoryId || null,
            paymentMethod: form.paymentMethod,
            poloId: form.poloId || null,
            responsibleUserId: form.responsibleUserId || null,
            responsibleName: form.responsibleName,
            invoiceNumber: form.invoiceNumber,
            supplier: form.supplier,
            notes: form.notes,
            attachmentUrl: form.attachmentUrl || null,
            attachmentPublicId: form.attachmentPublicId || null,
            attachmentFileName: form.attachmentFileName || null,
          };
      const res = await fetch(
        editing
          ? `/api/admin/gerencia/financeiro/lancamentos/${editing.id}`
          : "/api/admin/gerencia/financeiro/lancamentos",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as ApiResponse<{ entry: FinancialEntryView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", editing ? "Lançamento atualizado." : "Lançamento registrado.");
      setFormOpen(false);
      clearSuggestion();
      void load();
    } catch {
      toast.push("error", "Falha ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
  }

  async function markAsPaid(entry: FinancialEntryView) {
    const res = await fetch(`/api/admin/gerencia/financeiro/lancamentos/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "PAGO" }),
    });
    const json = (await res.json()) as ApiResponse<{ entry: FinancialEntryView }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao marcar como pago.");
      return;
    }
    toast.push("success", "Conta marcada como paga.");
    void load();
  }

  async function archiveEntry(entry: FinancialEntryView) {
    if (!window.confirm("Arquivar este lançamento?")) return;
    const res = await fetch(`/api/admin/gerencia/financeiro/lancamentos/${entry.id}`, {
      method: "DELETE",
    });
    const json = (await res.json()) as ApiResponse<{ archived?: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao arquivar.");
      return;
    }
    toast.push("success", "Lançamento arquivado.");
    void load();
  }

  async function saveCategory() {
    if (!catName.trim()) {
      toast.push("error", "Informe o nome da categoria.");
      return;
    }
    setCatSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/financeiro/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName, kind: catKind }),
      });
      const json = (await res.json()) as ApiResponse<{ category: FinancialCategoryView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao criar categoria.");
        return;
      }
      toast.push("success", "Categoria criada.");
      setCatOpen(false);
      setCatName("");
      void load();
    } catch {
      toast.push("error", "Falha ao criar categoria.");
    } finally {
      setCatSaving(false);
    }
  }

  function exportXlsx() {
    const rows = entries.map((e) => ({
      "Data de vencimento": formatEntryDate(e.entryDate),
      Status: FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus],
      Tipo: FINANCIAL_ENTRY_KIND_LABEL[e.kind],
      Descrição: e.description,
      Valor: e.amountCents / 100,
      Categoria: e.category?.name ?? "",
      Pagamento: FINANCIAL_PAYMENT_METHOD_LABEL[e.paymentMethod],
      Polo: e.polo?.name ?? "",
      Responsável: responsibleLabel(e),
      "Nº nota": e.invoiceNumber ?? "",
      Fornecedor: e.supplier ?? "",
      Observações: e.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    XLSX.writeFile(wb, `financeiro_${month || "periodo"}.xlsx`);
  }

  function exportPdf() {
    const w = window.open("", "_blank");
    if (!w) {
      toast.push("error", "Permita pop-ups para exportar o PDF.");
      return;
    }
    const rowsHtml = entries
      .map(
        (e) =>
          `<tr>
            <td>${formatEntryDate(e.entryDate)}</td>
            <td>${FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus]}</td>
            <td>${FINANCIAL_ENTRY_KIND_LABEL[e.kind]}</td>
            <td>${e.description}</td>
            <td style="text-align:right">${formatCentsBRL(e.amountCents)}</td>
            <td>${e.category?.name ?? "—"}</td>
            <td>${responsibleLabel(e)}</td>
          </tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>Financeiro</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 8px}
        .meta{color:#555;margin-bottom:16px;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f5f5f5}
        .totais{margin-top:16px;font-size:13px}
      </style></head><body>
      <h1>Relatório financeiro</h1>
      <div class="meta">Competência: ${month || "todas"} · ${entries.length} lançamento(s)</div>
      <table><thead><tr>
        <th>Data de vencimento</th><th>Status</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Responsável</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="totais">
        Entradas: <strong>${formatCentsBRL(totals.entradasCents)}</strong> ·
        Saídas: <strong>${formatCentsBRL(totals.saidasCents)}</strong> ·
        Saldo: <strong>${formatCentsBRL(totals.saldoCents)}</strong>
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  function exportPrestacao() {
    const rows = entries.map((e, idx) => ({
      "#": idx + 1,
      Descrição: e.description,
      Data: formatEntryDate(e.entryDate),
      Status: FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus],
      Valor: e.amountCents / 100,
      "Forma de pagamento": FINANCIAL_PAYMENT_METHOD_LABEL[e.paymentMethod],
      "Destino / observação": e.notes ?? "",
      Responsável: responsibleLabel(e),
      Tipo: FINANCIAL_ENTRY_KIND_LABEL[e.kind],
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prestacao");
    XLSX.writeFile(wb, `prestacao_contas_${month || "periodo"}.xlsx`);
  }

  function tabBtn(id: TabId, label: string) {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-[var(--igh-primary)] text-white"
            : "bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Financeiro"
        title="Entradas e saídas"
        description="Fluxo de caixa com vencimento, status de pagamento e leitura de NF no anexo."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCatOpen(true)}>
              Categorias
            </Button>
            {tab === "fluxo" || tab === "prestacao" ? (
              <>
                <Button
                  variant="secondary"
                  onClick={tab === "prestacao" ? exportPrestacao : exportXlsx}
                  disabled={entries.length === 0}
                >
                  Excel
                </Button>
                {tab === "fluxo" ? (
                  <Button variant="secondary" onClick={exportPdf} disabled={entries.length === 0}>
                    PDF
                  </Button>
                ) : null}
                <Button onClick={() => openCreate("SAIDA")}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Novo lançamento
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => void loadMei()} disabled={meiLoading}>
                {meiLoading ? "Atualizando…" : "Atualizar"}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabBtn("fluxo", "Fluxo")}
        {tabBtn("prestacao", "Prestação")}
        {tabBtn("notas-mei", "Notas MEI")}
      </div>

      {(alerts.dueTodayCount > 0 || alerts.dueSoonCount > 0 || alerts.overdueCount > 0) &&
      (tab === "fluxo" || tab === "prestacao") ? (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Atenção às contas</p>
          <ul className="list-inside list-disc space-y-1 text-[var(--text)] dark:text-amber-50">
            {alerts.dueTodayCount > 0 ? (
              <li>
                <strong>{alerts.dueTodayCount}</strong> conta(s) vencem <strong>hoje</strong> — marque como
                paga após o pagamento; amanhã passará automaticamente para Pendente.
              </li>
            ) : null}
            {alerts.dueSoonCount > 0 ? (
              <li>
                <strong>{alerts.dueSoonCount}</strong> conta(s) vencem nos próximos{" "}
                <strong>{alerts.dueSoonDays} dias</strong>.
              </li>
            ) : null}
            {alerts.overdueCount > 0 ? (
              <li>
                <strong>{alerts.overdueCount}</strong> conta(s) <strong>pendente(s)</strong> (vencimento
                já passou sem pagamento).
              </li>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {alerts.dueTodayCount > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStatusFilter("");
                  setMonth("");
                  setDueAlertFilter("today");
                }}
              >
                Ver as de hoje
              </Button>
            ) : null}
            {alerts.dueSoonCount > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStatusFilter("");
                  setMonth("");
                  setDueAlertFilter("soon");
                }}
              >
                Ver a vencer
              </Button>
            ) : null}
            {alerts.overdueCount > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDueAlertFilter("");
                  setStatusFilter("PENDENTE");
                }}
              >
                Ver pendentes
              </Button>
            ) : null}
            {dueAlertFilter || statusFilter === "PENDENTE" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDueAlertFilter("");
                  setStatusFilter("");
                  setMonth(brazilTodayIsoDate().slice(0, 7));
                }}
              >
                Limpar alerta
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "fluxo" || tab === "prestacao" ? (
        <>
          {tab === "prestacao" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Total de valores"
                value={formatCentsBRL(totals.saidasCents + totals.entradasCents)}
                icon={Scale}
                accent="sky"
              />
              <StatTile
                label="Total de lançamentos"
                value={String(entries.length)}
                icon={ArrowDownCircle}
                accent="amber"
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Entradas"
                value={formatCentsBRL(totals.entradasCents)}
                icon={ArrowUpCircle}
                accent="emerald"
              />
              <StatTile
                label="Saídas"
                value={formatCentsBRL(totals.saidasCents)}
                icon={ArrowDownCircle}
                accent="rose"
              />
              <StatTile label="Saldo" value={formatCentsBRL(totals.saldoCents)} icon={Scale} accent="sky" />
            </div>
          )}

          <SectionCard title="Filtros" variant="elevated">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Mês (vencimento)</span>
                <Input className="mt-1" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </label>
              {tab === "fluxo" ? (
                <>
                  <label className="block text-sm">
                    <span className="text-[var(--text-muted)]">Tipo</span>
                    <select
                      className={`mt-1 ${selectClass}`}
                      value={kindFilter}
                      onChange={(e) => setKindFilter(e.target.value as "" | FinancialEntryKind)}
                    >
                      <option value="">Todos</option>
                      {FINANCIAL_ENTRY_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {FINANCIAL_ENTRY_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--text-muted)]">Status pagamento</span>
                    <select
                      className={`mt-1 ${selectClass}`}
                      value={statusFilter}
                      onChange={(e) => {
                        setDueAlertFilter("");
                        setStatusFilter(e.target.value as "" | FinancialPaymentStatus);
                      }}
                    >
                      <option value="">Todos</option>
                      {FINANCIAL_PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {FINANCIAL_PAYMENT_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--text-muted)]">Categoria</span>
                    <select
                      className={`mt-1 ${selectClass}`}
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="">Todas</option>
                      {categoriesForFilter.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--text-muted)]">Polo</span>
                    <select
                      className={`mt-1 ${selectClass}`}
                      value={poloFilter}
                      onChange={(e) => setPoloFilter(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {polos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Busca</span>
                <div className="relative mt-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden
                  />
                  <Input
                    className="pl-9"
                    placeholder={tab === "prestacao" ? "Descrição, destino…" : "Descrição, nota, fornecedor…"}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title={tab === "prestacao" ? "Prestação de contas" : "Lançamentos"}
            description={
              tab === "prestacao"
                ? `${entries.length} movimentação(ões) no mês · estilo controle de contas`
                : `${entries.length} registro(s) no filtro atual.`
            }
            variant="elevated"
          >
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : entries.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Nenhum lançamento neste período.
              </p>
            ) : tab === "prestacao" ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Descrição</Th>
                    <Th>Vencimento</Th>
                    <Th>Status</Th>
                    <Th>Valor</Th>
                    <Th>Forma de pagamento</Th>
                    <Th>Destino / observação</Th>
                    <Th>Responsável</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <Td className="font-medium">{e.description}</Td>
                      <Td className="whitespace-nowrap">{formatEntryDate(e.entryDate)}</Td>
                      <Td>
                        <Badge tone={paymentStatusBadgeTone(e.paymentStatus, e.dueUrgency)}>
                          {FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus]}
                          {e.dueUrgency === "due_today" && e.paymentStatus !== "PAGO" ? " · hoje" : ""}
                          {e.dueUrgency === "due_soon" && e.paymentStatus === "EM_ABERTO" ? " · a vencer" : ""}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap font-medium">{formatCentsBRL(e.amountCents)}</Td>
                      <Td>{FINANCIAL_PAYMENT_METHOD_LABEL[e.paymentMethod]}</Td>
                      <Td className="max-w-[220px] text-sm text-[var(--text-muted)]">{e.notes ?? "—"}</Td>
                      <Td>{responsibleLabel(e)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {e.paymentStatus !== "PAGO" ? (
                            <Button size="sm" onClick={() => void markAsPaid(e)}>
                              Marcar pago
                            </Button>
                          ) : null}
                          <Button size="sm" variant="secondary" onClick={() => openEdit(e)}>
                            Editar
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Vencimento</Th>
                    <Th>Status</Th>
                    <Th>Tipo</Th>
                    <Th>Descrição</Th>
                    <Th>Valor</Th>
                    <Th>Categoria</Th>
                    <Th>Responsável</Th>
                    <Th>Anexo</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <Td className="whitespace-nowrap">{formatEntryDate(e.entryDate)}</Td>
                      <Td>
                        <Badge tone={paymentStatusBadgeTone(e.paymentStatus, e.dueUrgency)}>
                          {FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus]}
                          {e.dueUrgency === "due_today" && e.paymentStatus !== "PAGO" ? " · hoje" : ""}
                          {e.dueUrgency === "due_soon" && e.paymentStatus === "EM_ABERTO" ? " · a vencer" : ""}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone={e.kind === "ENTRADA" ? "green" : "red"}>
                          {FINANCIAL_ENTRY_KIND_LABEL[e.kind]}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="font-medium">{e.description}</div>
                        {e.invoiceNumber ? (
                          <div className="text-xs text-[var(--text-muted)]">Nota {e.invoiceNumber}</div>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap font-medium">{formatCentsBRL(e.amountCents)}</Td>
                      <Td>{e.category?.name ?? "—"}</Td>
                      <Td>{responsibleLabel(e)}</Td>
                      <Td>
                        {e.attachmentUrl ? (
                          <a
                            href={e.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-[var(--igh-primary)] hover:underline"
                          >
                            Abrir
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {e.paymentStatus !== "PAGO" ? (
                            <Button size="sm" onClick={() => void markAsPaid(e)}>
                              Marcar pago
                            </Button>
                          ) : null}
                          <Button size="sm" variant="secondary" onClick={() => openEdit(e)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => void archiveEntry(e)}>
                            Arquivar
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          title="Notas MEI"
          description="Notas mensais de colaboradores MEI. Use “Lançar no fluxo” para criar um lançamento de saída."
          variant="elevated"
        >
          <div className="mb-3 max-w-xs">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Mês de competência</span>
              <Input className="mt-1" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          </div>
          {meiLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : meiInvoices.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              Nenhuma nota MEI neste mês. Cadastre em Contratos → Notas mensais.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Competência</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                  <Th>PDF</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {meiInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <Td className="font-medium">{inv.employee?.name ?? "—"}</Td>
                    <Td>{formatReferenceMonth(inv.referenceMonth)}</Td>
                    <Td>{formatCentsBRL(inv.amountCents)}</Td>
                    <Td>
                      <Badge tone={inv.status === "ENTREGUE" ? "green" : "amber"}>
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </Td>
                    <Td>
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-[var(--igh-primary)] hover:underline"
                        >
                          Abrir
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <Button size="sm" variant="secondary" onClick={() => openFromMeiInvoice(inv)}>
                        Lançar no fluxo
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          clearSuggestion();
        }}
        title={editing ? "Editar lançamento" : "Novo lançamento"}
        size="large"
      >
        <div className="space-y-4">
          {suggestionHasAny(suggestion) ? (
            <div className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-3 text-sm">
              <div className="font-medium">Sugestões da nota — revise antes de salvar</div>
              {suggestionSource ? (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Fonte: {suggestionSource}</p>
              ) : null}
              <ul className="mt-2 space-y-0.5 text-[var(--text-muted)]">
                {suggestion?.amount ? <li>Valor: R$ {suggestion.amount}</li> : null}
                {suggestion?.supplier ? <li>Fornecedor: {suggestion.supplier}</li> : null}
                {suggestion?.invoiceNumber ? <li>Nº: {suggestion.invoiceNumber}</li> : null}
                {suggestion?.entryDate ? <li>Vencimento: {suggestion.entryDate}</li> : null}
                {suggestion?.categoryName ? <li>Categoria: {suggestion.categoryName}</li> : null}
                {suggestion?.description ? <li>Descrição: {suggestion.description}</li> : null}
              </ul>
              {suggestionWarnings.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  {suggestionWarnings.join(" ")}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => applySuggestion(false)}>
                  Aplicar nos vazios
                </Button>
                <Button size="sm" variant="secondary" onClick={() => applySuggestion(true)}>
                  Sobrescrever campos
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSuggestion}>
                  Ignorar
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Tipo</span>
              <select
                className={`mt-1 ${selectClass}`}
                value={form.kind}
                onChange={(e) => {
                  const kind = e.target.value as FinancialEntryKind;
                  setForm((prev) => ({ ...prev, kind, categoryId: "" }));
                }}
              >
                {FINANCIAL_ENTRY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FINANCIAL_ENTRY_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Data de vencimento</span>
              <Input
                className="mt-1"
                type="date"
                value={form.entryDate}
                onChange={(e) => setField("entryDate", e.target.value)}
              />
            </label>
            {!editing && isPastDueDate(form.entryDate) ? (
              <label className="block text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Esta conta já foi paga?</span>
                <select
                  className={`mt-1 ${selectClass}`}
                  value={form.alreadyPaid ? "sim" : "nao"}
                  onChange={(e) => setField("alreadyPaid", e.target.value === "sim")}
                >
                  <option value="nao">Não — entrar como Pendente</option>
                  <option value="sim">Sim — entrar como Pago</option>
                </select>
              </label>
            ) : null}
            {!editing && !isPastDueDate(form.entryDate) ? (
              <p className="sm:col-span-2 text-xs text-[var(--text-muted)]">
                Com vencimento hoje ou futuro, a conta entra como <strong>Em aberto</strong>. No dia do
                vencimento você verá um alerta; se não marcar como paga, no dia seguinte passa a{" "}
                <strong>Pendente</strong> automaticamente.
              </p>
            ) : null}
            {editing ? (
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Status do pagamento</span>
                <select
                  className={`mt-1 ${selectClass}`}
                  value={form.paymentStatus}
                  onChange={(e) => setField("paymentStatus", e.target.value as FinancialPaymentStatus)}
                >
                  {FINANCIAL_PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {FINANCIAL_PAYMENT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">Descrição *</span>
              <Input
                className="mt-1"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Valor (R$) *</span>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
                placeholder="0,00"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Categoria</span>
              <select
                className={`mt-1 ${selectClass}`}
                value={form.categoryId}
                onChange={(e) => setField("categoryId", e.target.value)}
              >
                <option value="">Sem categoria</option>
                {categoriesForForm.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Forma de pagamento</span>
              <select
                className={`mt-1 ${selectClass}`}
                value={form.paymentMethod}
                onChange={(e) => setField("paymentMethod", e.target.value as FinancialPaymentMethod)}
              >
                {FINANCIAL_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {FINANCIAL_PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Polo</span>
              <select
                className={`mt-1 ${selectClass}`}
                value={form.poloId}
                onChange={(e) => setField("poloId", e.target.value)}
              >
                <option value="">Sem polo</option>
                {polos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Responsável (usuário)</span>
              <select
                className={`mt-1 ${selectClass}`}
                value={form.responsibleUserId}
                onChange={(e) => setField("responsibleUserId", e.target.value)}
              >
                <option value="">Nome livre abaixo</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Responsável (nome livre)</span>
              <Input
                className="mt-1"
                value={form.responsibleName}
                onChange={(e) => setField("responsibleName", e.target.value)}
                placeholder="Se não tiver conta no sistema"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Nº da nota</span>
              <Input
                className="mt-1"
                value={form.invoiceNumber}
                onChange={(e) => setField("invoiceNumber", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Fornecedor / origem</span>
              <Input
                className="mt-1"
                value={form.supplier}
                onChange={(e) => setField("supplier", e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">
                Destino / observações (ex.: saídas para o galpão)
              </span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-[var(--text-muted)]">
              Anexo da nota (PDF ou imagem) — após o envio, o sistema tenta ler valor, fornecedor, nº e
              data de vencimento.
            </p>
            {form.attachmentUrl ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <a
                  href={form.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--igh-primary)] hover:underline"
                >
                  {form.attachmentFileName || "Arquivo anexado"}
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={readingInvoice}
                  onClick={() => void readInvoice(form.attachmentUrl, form.attachmentFileName)}
                >
                  {readingInvoice ? "Lendo…" : "Ler nota de novo"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      attachmentUrl: "",
                      attachmentPublicId: "",
                      attachmentFileName: "",
                    }));
                    clearSuggestion();
                  }}
                >
                  Remover
                </Button>
              </div>
            ) : (
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                disabled={uploading || readingInvoice}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadAttachment(file);
                }}
              />
            )}
            {uploading ? <p className="text-sm text-[var(--text-muted)]">Enviando anexo…</p> : null}
            {readingInvoice ? <p className="text-sm text-[var(--text-muted)]">Lendo nota…</p> : null}
            {!suggestionHasAny(suggestion) && suggestionWarnings.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">{suggestionWarnings.join(" ")}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setFormOpen(false);
                clearSuggestion();
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={() => void saveEntry()} disabled={saving || uploading || readingInvoice}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="Categorias financeiras" size="large">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">Nova categoria</span>
              <Input className="mt-1" value={catName} onChange={(e) => setCatName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Tipo</span>
              <select
                className={`mt-1 ${selectClass}`}
                value={catKind}
                onChange={(e) => setCatKind(e.target.value as FinancialEntryKind)}
              >
                {FINANCIAL_ENTRY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FINANCIAL_ENTRY_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button onClick={() => void saveCategory()} disabled={catSaving}>
            {catSaving ? "Salvando…" : "Adicionar categoria"}
          </Button>
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <Td>{c.name}</Td>
                  <Td>{FINANCIAL_ENTRY_KIND_LABEL[c.kind]}</Td>
                  <Td>
                    <Badge tone={c.isActive ? "green" : "zinc"}>{c.isActive ? "Ativa" : "Inativa"}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Modal>
    </PanelPageStack>
  );
}
