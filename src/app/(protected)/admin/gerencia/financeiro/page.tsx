"use client";

import * as XLSX from "xlsx";
import { ArrowDownCircle, ArrowUpCircle, Download, Pin, Plus, Repeat, Scale, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  displayExpenseNature,
  FINANCIAL_ENTRY_KIND_LABEL,
  FINANCIAL_ENTRY_KINDS,
  FINANCIAL_EXPENSE_NATURE_LABEL,
  FINANCIAL_EXPENSE_NATURES,
  FINANCIAL_PAYMENT_METHOD_LABEL,
  FINANCIAL_PAYMENT_METHODS,
  FINANCIAL_PAYMENT_STATUS_LABEL,
  FINANCIAL_PAYMENT_STATUSES,
  formatEntryDate,
  paymentStatusBadgeTone,
  responsibleLabel,
  type FinancialAttachmentView,
  type FinancialCategoryView,
  type FinancialEntryView,
} from "@/lib/financeiro";
import { MAX_FINANCIAL_ATTACHMENTS } from "@/lib/financeiro-attachments";
import { brazilTodayIsoDate, isPastDueDate } from "@/lib/financeiro-payment-shared";
import type {
  FinancialEntryKind,
  FinancialExpenseNature,
  FinancialPaymentMethod,
  FinancialPaymentStatus,
} from "@/generated/prisma/client";

type PoloOption = { id: string; name: string };
type UserOption = { id: string; name: string; email: string };
type Totals = {
  entradasCents: number;
  saidasCents: number;
  saidasFixasCents?: number;
  saidasVariaveisCents?: number;
  saldoCents: number;
};
type PaymentAlerts = {
  dueSoonCount: number;
  dueTodayCount: number;
  overdueCount: number;
  dueSoonDays: number;
};
type FixedExpenseAlert = {
  description: string;
  categoryName: string | null;
  expectedAmountCents: number | null;
  lastEntryDate: string;
  missingForMonth: string;
};
type FixedExpenseForecast = {
  currentExpectedCents: number;
  nextExpectedCents: number;
};
type FixedExpenseMeta = {
  targetMonth: string;
  currentMonth: string;
  nextMonth: string;
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

type FormAttachment = {
  key: string;
  id?: string;
  url: string;
  publicId: string;
  fileName: string;
  description: string;
};

type PreviewTarget = {
  entryId: string;
  attachment: FinancialAttachmentView;
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
  attachments: FormAttachment[];
  expenseNature: FinancialExpenseNature | "";
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
    attachments: [],
    expenseNature: "VARIAVEL",
  };
}

function toFormAttachments(entry: FinancialEntryView): FormAttachment[] {
  const list =
    entry.attachments && entry.attachments.length > 0
      ? entry.attachments
      : entry.attachmentUrl
        ? [
            {
              id: "legacy",
              url: entry.attachmentUrl,
              publicId: entry.attachmentPublicId,
              fileName: entry.attachmentFileName,
              description: entry.attachmentFileName || "Anexo",
            },
          ]
        : [];
  return list.map((a) => ({
    key: a.id,
    id: a.id,
    url: a.url,
    publicId: a.publicId ?? "",
    fileName: a.fileName ?? "",
    description: a.description,
  }));
}

function payloadAttachments(attachments: FormAttachment[]) {
  return attachments.map((a) => ({
    url: a.url,
    publicId: a.publicId || null,
    fileName: a.fileName || null,
    description: a.description.trim() || a.fileName || "Anexo",
  }));
}

function attachmentPreviewKind(fileName?: string | null, url?: string | null): "pdf" | "image" | "other" {
  const s = `${fileName || ""} ${url || ""}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/.test(s) || s.includes("image/")) return "image";
  if (/\.pdf(\?|#|$)/.test(s) || s.includes("application/pdf")) return "pdf";
  return "other";
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
  const [totals, setTotals] = useState<Totals>({
    entradasCents: 0,
    saidasCents: 0,
    saidasFixasCents: 0,
    saidasVariaveisCents: 0,
    saldoCents: 0,
  });
  const [alerts, setAlerts] = useState<PaymentAlerts>({
    dueSoonCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    dueSoonDays: 7,
  });
  const [fixedExpenseAlerts, setFixedExpenseAlerts] = useState<FixedExpenseAlert[]>([]);
  const [fixedExpenseForecast, setFixedExpenseForecast] = useState<FixedExpenseForecast>({
    currentExpectedCents: 0,
    nextExpectedCents: 0,
  });
  const [fixedExpenseMeta, setFixedExpenseMeta] = useState<FixedExpenseMeta>({
    targetMonth: "",
    currentMonth: "",
    nextMonth: "",
  });
  const [categories, setCategories] = useState<FinancialCategoryView[]>([]);
  const [polos, setPolos] = useState<PoloOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | FinancialEntryKind>("");
  const [statusFilter, setStatusFilter] = useState<"" | FinancialPaymentStatus>("");
  const [dueAlertFilter, setDueAlertFilter] = useState<"" | "today" | "soon" | "overdue" | "attention">(
    "",
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [poloFilter, setPoloFilter] = useState("");
  const [expenseNatureFilter, setExpenseNatureFilter] = useState<"" | FinancialExpenseNature | "NONE">("");
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

  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [attachmentLabel, setAttachmentLabel] = useState("");

  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<FinancialEntryKind>("SAIDA");
  const [catSaving, setCatSaving] = useState(false);
  const [importingSheet, setImportingSheet] = useState(false);
  const importSheetInputRef = useRef<HTMLInputElement>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (dateFrom || dateTo) {
      if (dateFrom) sp.set("from", dateFrom);
      if (dateTo) sp.set("to", dateTo);
    } else if (month) {
      sp.set("month", month);
    }
    if (tab !== "prestacao") {
      if (kindFilter) sp.set("kind", kindFilter);
      if (statusFilter) sp.set("paymentStatus", statusFilter);
      if (dueAlertFilter) sp.set("dueAlert", dueAlertFilter);
      if (categoryFilter) sp.set("categoryId", categoryFilter);
      if (poloFilter) sp.set("poloId", poloFilter);
      if (expenseNatureFilter) sp.set("expenseNature", expenseNatureFilter);
    }
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [
    tab,
    month,
    dateFrom,
    dateTo,
    kindFilter,
    statusFilter,
    dueAlertFilter,
    categoryFilter,
    poloFilter,
    expenseNatureFilter,
    q,
  ]);

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
        fixedExpenseAlerts?: FixedExpenseAlert[];
        fixedExpenseForecast?: FixedExpenseForecast;
        fixedExpenseMeta?: FixedExpenseMeta;
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
      setFixedExpenseAlerts(eJson.data.fixedExpenseAlerts ?? []);
      if (eJson.data.fixedExpenseForecast) setFixedExpenseForecast(eJson.data.fixedExpenseForecast);
      if (eJson.data.fixedExpenseMeta) setFixedExpenseMeta(eJson.data.fixedExpenseMeta);
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

  const prestacaoPeriodLabel = month || (dateFrom || dateTo ? `${dateFrom || "…"} a ${dateTo || "…"}` : "todos");
  const prestacaoFixas = useMemo(
    () => entries.filter((e) => e.kind === "SAIDA" && e.expenseNature === "FIXA"),
    [entries],
  );
  const prestacaoVariaveis = useMemo(
    () => entries.filter((e) => e.kind === "SAIDA" && e.expenseNature !== "FIXA"),
    [entries],
  );
  const prestacaoFixasTotal = prestacaoFixas.reduce((sum, e) => sum + e.amountCents, 0);
  const prestacaoVariaveisTotal = prestacaoVariaveis.reduce((sum, e) => sum + e.amountCents, 0);

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
    setAttachmentLabel("");
    setForm({
      ...emptyForm(),
      kind,
      expenseNature: kind === "SAIDA" ? "VARIAVEL" : "",
    });
    clearSuggestion();
    setFormOpen(true);
  }

  function openEdit(entry: FinancialEntryView) {
    setEditing(entry);
    setAttachmentLabel("");
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
      attachments: toFormAttachments(entry),
      expenseNature: entry.kind === "SAIDA" ? (entry.expenseNature ?? "VARIAVEL") : "",
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
      attachments: inv.pdfUrl
        ? [
            {
              key: `mei-${inv.id}`,
              url: inv.pdfUrl,
              publicId: inv.pdfPublicId ?? "",
              fileName: `nota-mei-${competencia.replace("/", "-")}.pdf`,
              description: "Nota MEI",
            },
          ]
        : [],
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
    if (form.attachments.length >= MAX_FINANCIAL_ATTACHMENTS) {
      toast.push("error", `No máximo ${MAX_FINANCIAL_ATTACHMENTS} anexos por lançamento.`);
      return;
    }
    const description = attachmentLabel.trim() || file.name;
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
        attachments: [
          ...prev.attachments,
          {
            key: `${Date.now()}-${fileName}`,
            url: cloud.url!,
            publicId: cloud.publicId,
            fileName,
            description,
          },
        ],
      }));
      setAttachmentLabel("");
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
            attachments: payloadAttachments(form.attachments),
            expenseNature: form.kind === "SAIDA" ? form.expenseNature || "VARIAVEL" : null,
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
            attachments: payloadAttachments(form.attachments),
            expenseNature: form.kind === "SAIDA" ? form.expenseNature || "VARIAVEL" : null,
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
      setCatName("");
      void load();
    } catch {
      toast.push("error", "Falha ao criar categoria.");
    } finally {
      setCatSaving(false);
    }
  }

  async function toggleCategory(c: FinancialCategoryView) {
    const res = await fetch(`/api/admin/gerencia/financeiro/categorias/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    const json = (await res.json()) as ApiResponse<{ category: FinancialCategoryView }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar categoria.");
      return;
    }
    toast.push("success", json.data.category.isActive ? "Categoria ativada." : "Categoria desativada.");
    void load();
  }

  async function removeCategory(c: FinancialCategoryView) {
    if (!confirm(`Remover a categoria "${c.name}"? Se houver lançamentos, ela será só desativada.`)) {
      return;
    }
    const res = await fetch(`/api/admin/gerencia/financeiro/categorias/${c.id}`, {
      method: "DELETE",
    });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean; deactivated?: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao remover categoria.");
      return;
    }
    toast.push(
      "success",
      json.data.deactivated ? "Categoria desativada (há lançamentos)." : "Categoria removida.",
    );
    void load();
  }

  function exportXlsx() {
    const rows = entries.map((e) => ({
      "Data de vencimento": formatEntryDate(e.entryDate),
      Status: FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus],
      Tipo: FINANCIAL_ENTRY_KIND_LABEL[e.kind],
      Descrição: e.description,
      Valor: e.amountCents / 100,
      Categoria: e.category?.name ?? "",
      Natureza: displayExpenseNature(e.kind, e.expenseNature),
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
    XLSX.writeFile(wb, `financeiro_${month || (dateFrom && dateTo ? `${dateFrom}_${dateTo}` : dateFrom || dateTo || "periodo")}.xlsx`);
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
            <td>${displayExpenseNature(e.kind, e.expenseNature)}</td>
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
      <div class="meta">Período: ${month || (dateFrom || dateTo ? `${dateFrom || "…"} a ${dateTo || "…"}` : "todos")} · ${entries.length} lançamento(s)</div>
      <table><thead><tr>
        <th>Data de vencimento</th><th>Status</th><th>Tipo</th><th>Natureza</th><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Responsável</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="totais">
        Entradas: <strong>${formatCentsBRL(totals.entradasCents)}</strong> ·
        Saídas: <strong>${formatCentsBRL(totals.saidasCents)}</strong>
        ${totals.saidasFixasCents != null ? ` · Fixas: <strong>${formatCentsBRL(totals.saidasFixasCents)}</strong>` : ""}
        ${totals.saidasVariaveisCents != null ? ` · Variáveis: <strong>${formatCentsBRL(totals.saidasVariaveisCents)}</strong>` : ""}
         ·
        Saldo: <strong>${formatCentsBRL(totals.saldoCents)}</strong>
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  function exportPrestacaoRows(
    list: FinancialEntryView[],
    sheetName: string,
    fileSuffix: string,
  ) {
    const rows = list.map((e, idx) => ({
      "#": idx + 1,
      Descrição: e.description,
      Data: formatEntryDate(e.entryDate),
      Status: FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus],
      Valor: e.amountCents / 100,
      "Forma de pagamento": FINANCIAL_PAYMENT_METHOD_LABEL[e.paymentMethod],
      "Destino / observação": e.notes ?? "",
      Responsável: responsibleLabel(e),
      Tipo: FINANCIAL_ENTRY_KIND_LABEL[e.kind],
      Natureza: displayExpenseNature(e.kind, e.expenseNature),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `prestacao_contas_${fileSuffix}_${month || "periodo"}.xlsx`);
  }

  function exportPrestacaoWorkbook() {
    function toRows(list: FinancialEntryView[]) {
      return list.map((e, idx) => ({
        "#": idx + 1,
        Descrição: e.description,
        Data: formatEntryDate(e.entryDate),
        Status: FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus],
        Valor: e.amountCents / 100,
        "Forma de pagamento": FINANCIAL_PAYMENT_METHOD_LABEL[e.paymentMethod],
        "Destino / observação": e.notes ?? "",
        Responsável: responsibleLabel(e),
        Natureza: displayExpenseNature(e.kind, e.expenseNature),
      }));
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(prestacaoFixas)), "Contas fixas");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(toRows(prestacaoVariaveis)),
      "Contas variaveis",
    );
    XLSX.writeFile(wb, `prestacao_contas_fixas_e_variaveis_${month || "periodo"}.xlsx`);
  }

  function exportPrestacaoPdf(
    list: FinancialEntryView[],
    title: string,
    totalCents: number,
  ) {
    const w = window.open("", "_blank");
    if (!w) {
      toast.push("error", "Permita pop-ups para exportar o PDF.");
      return;
    }
    const rowsHtml = list
      .map(
        (e) =>
          `<tr>
            <td>${e.description}</td>
            <td>${formatEntryDate(e.entryDate)}</td>
            <td>${FINANCIAL_PAYMENT_STATUS_LABEL[e.paymentStatus]}</td>
            <td>${displayExpenseNature(e.kind, e.expenseNature)}</td>
            <td style="text-align:right">${formatCentsBRL(e.amountCents)}</td>
            <td>${FINANCIAL_PAYMENT_METHOD_LABEL[e.paymentMethod]}</td>
            <td>${e.notes ?? "—"}</td>
            <td>${responsibleLabel(e)}</td>
          </tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>${title}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 8px}
        .meta{color:#555;margin-bottom:16px;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f5f5f5}
        .totais{margin-top:16px;font-size:13px}
      </style></head><body>
      <h1>${title}</h1>
      <div class="meta">Período: ${prestacaoPeriodLabel} · ${list.length} lançamento(s)</div>
      <table><thead><tr>
        <th>Descrição</th><th>Vencimento</th><th>Status</th><th>Natureza</th><th>Valor</th><th>Pagamento</th><th>Destino</th><th>Responsável</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="totais">Total: <strong>${formatCentsBRL(totalCents)}</strong></div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  function exportPrestacao() {
    exportPrestacaoWorkbook();
  }

  function prestacaoTable(rows: FinancialEntryView[]) {
    if (rows.length === 0) {
      return (
        <p className="rounded-md border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          Nenhuma conta neste relatório no período.
        </p>
      );
    }
    return (
      <Table>
        <thead>
          <tr>
            <Th>Descrição</Th>
            <Th>Vencimento</Th>
            <Th>Status</Th>
            <Th>Natureza</Th>
            <Th>Valor</Th>
            <Th>Forma de pagamento</Th>
            <Th>Destino / observação</Th>
            <Th>Responsável</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
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
              <Td>
                <Badge
                  tone={e.expenseNature === "FIXA" ? "blue" : e.expenseNature ? "zinc" : "amber"}
                >
                  {displayExpenseNature(e.kind, e.expenseNature)}
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
    );
  }

  async function importPrestacaoSheet(file: File) {
    setImportingSheet(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/gerencia/financeiro/importar-prestacao", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as ApiResponse<{
        created: number;
        skippedInvalid: Array<{ rowNumber: number; reason: string }>;
        skippedDuplicates: Array<{ description: string }>;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao importar a planilha.");
        return;
      }
      const { created, skippedInvalid, skippedDuplicates } = json.data;
      const parts = [`${created} saída(s) cadastrada(s)`];
      if (skippedDuplicates.length) parts.push(`${skippedDuplicates.length} duplicada(s) ignorada(s)`);
      if (skippedInvalid.length) parts.push(`${skippedInvalid.length} linha(s) inválida(s)`);
      toast.push(created > 0 ? "success" : "error", parts.join(" · "));
      if (created > 0) void load();
    } catch {
      toast.push("error", "Falha ao importar a planilha.");
    } finally {
      setImportingSheet(false);
    }
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
        description={
          tab === "prestacao"
            ? "Relatórios separados de contas fixas e variáveis, com exportação independente."
            : "Fluxo de caixa com vencimento, status de pagamento e leitura de NF no anexo."
        }
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCatOpen(true)}>
              Categorias
            </Button>
            {tab === "fluxo" || tab === "prestacao" ? (
              <>
                <input
                  ref={importSheetInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="sr-only"
                  tabIndex={-1}
                  disabled={importingSheet}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void importPrestacaoSheet(file);
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={importingSheet}
                  onClick={() => importSheetInputRef.current?.click()}
                  title="Importa a planilha de Prestação de Contas como saídas"
                >
                  <Upload className="mr-1.5 h-4 w-4" aria-hidden />
                  {importingSheet ? "Importando…" : "Importar planilha"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={tab === "prestacao" ? exportPrestacaoWorkbook : exportXlsx}
                  disabled={
                    tab === "prestacao"
                      ? prestacaoFixas.length + prestacaoVariaveis.length === 0
                      : entries.length === 0
                  }
                >
                  {tab === "prestacao" ? "Excel (fixas + variáveis)" : "Excel"}
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
        {tabBtn("fluxo", "Fluxo de caixa")}
        {tabBtn("prestacao", "Prestação de contas")}
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

      {(tab === "fluxo" || tab === "prestacao") &&
      (fixedExpenseAlerts.length > 0 ||
        fixedExpenseForecast.currentExpectedCents > 0 ||
        fixedExpenseForecast.nextExpectedCents > 0) ? (
        <div className="space-y-2 rounded-md border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          <p className="font-medium">Despesas fixas previstas</p>
          {fixedExpenseMeta.currentMonth ? (
            <p className="text-[var(--text)] dark:text-sky-50">
              Previsão {formatReferenceMonth(`${fixedExpenseMeta.currentMonth}-01`)}:{" "}
              <strong>{formatCentsBRL(fixedExpenseForecast.currentExpectedCents)}</strong>
              {" · "}
              {formatReferenceMonth(`${fixedExpenseMeta.nextMonth}-01`)}:{" "}
              <strong>{formatCentsBRL(fixedExpenseForecast.nextExpectedCents)}</strong>
            </p>
          ) : null}
          {fixedExpenseAlerts.length > 0 ? (
            <>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Sem lançamento em {formatReferenceMonth(`${fixedExpenseMeta.targetMonth}-01`)}
              </p>
              <ul className="list-inside list-disc space-y-1 text-[var(--text)] dark:text-sky-50">
                {fixedExpenseAlerts.slice(0, 8).map((a) => (
                  <li key={`${a.description}-${a.missingForMonth}-${a.lastEntryDate}`}>
                    {a.description}
                    {a.categoryName ? ` · ${a.categoryName}` : ""}
                    {a.expectedAmountCents
                      ? ` · previsto ${formatCentsBRL(a.expectedAmountCents)}`
                      : ""}
                    {" · último em "}
                    {formatEntryDate(a.lastEntryDate)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[var(--text)] dark:text-sky-50">
              Todas as despesas fixas previstas já têm lançamento no período de referência.
            </p>
          )}
        </div>
      ) : null}

      {tab === "fluxo" || tab === "prestacao" ? (
        <>
          {tab === "prestacao" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Contas fixas"
                value={formatCentsBRL(prestacaoFixasTotal)}
                icon={Pin}
                accent="sky"
              />
              <StatTile
                label="Lançamentos fixos"
                value={String(prestacaoFixas.length)}
                icon={Pin}
                accent="sky"
              />
              <StatTile
                label="Contas variáveis"
                value={formatCentsBRL(prestacaoVariaveisTotal)}
                icon={Repeat}
                accent="amber"
              />
              <StatTile
                label="Lançamentos variáveis"
                value={String(prestacaoVariaveis.length)}
                icon={Repeat}
                accent="amber"
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              <StatTile
                label="Saídas fixas"
                value={formatCentsBRL(totals.saidasFixasCents ?? 0)}
                icon={Pin}
                accent="sky"
              />
              <StatTile
                label="Saídas variáveis"
                value={formatCentsBRL(totals.saidasVariaveisCents ?? 0)}
                icon={Repeat}
                accent="amber"
              />
              <StatTile label="Saldo" value={formatCentsBRL(totals.saldoCents)} icon={Scale} accent="sky" />
            </div>
          )}

          <SectionCard title="Filtros" variant="elevated">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Mês (vencimento)</span>
                <Input
                  className="mt-1"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Data início</span>
                <Input
                  className="mt-1"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Data final</span>
                <Input
                  className="mt-1"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                />
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
                  <label className="block text-sm">
                    <span className="text-[var(--text-muted)]">Natureza (saídas)</span>
                    <select
                      className={`mt-1 ${selectClass}`}
                      value={expenseNatureFilter}
                      onChange={(e) =>
                        setExpenseNatureFilter(e.target.value as "" | FinancialExpenseNature | "NONE")
                      }
                    >
                      <option value="">Todas</option>
                      {FINANCIAL_EXPENSE_NATURES.map((n) => (
                        <option key={n} value={n}>
                          {FINANCIAL_EXPENSE_NATURE_LABEL[n]}
                        </option>
                      ))}
                      <option value="NONE">Sem classificação</option>
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
            {(dateFrom || dateTo) ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Intervalo de datas em uso (vencimento). O filtro por mês fica em segundo plano enquanto houver
                data início e/ou data final.
              </p>
            ) : null}
          </SectionCard>

          {tab === "prestacao" ? (
            <>
              <SectionCard
                title="Relatório de contas fixas"
                description={`${prestacaoFixas.length} lançamento(s) · ${formatCentsBRL(prestacaoFixasTotal)} · ${prestacaoPeriodLabel}`}
                variant="elevated"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={prestacaoFixas.length === 0}
                      onClick={() => exportPrestacaoRows(prestacaoFixas, "Fixas", "fixas")}
                    >
                      Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={prestacaoFixas.length === 0}
                      onClick={() =>
                        exportPrestacaoPdf(
                          prestacaoFixas,
                          "Prestação de contas — Contas fixas",
                          prestacaoFixasTotal,
                        )
                      }
                    >
                      PDF
                    </Button>
                  </div>
                }
              >
                {loading ? (
                  <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
                ) : (
                  prestacaoTable(prestacaoFixas)
                )}
              </SectionCard>
              <SectionCard
                title="Relatório de contas variáveis"
                description={`${prestacaoVariaveis.length} lançamento(s) · ${formatCentsBRL(prestacaoVariaveisTotal)} · ${prestacaoPeriodLabel}`}
                variant="elevated"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={prestacaoVariaveis.length === 0}
                      onClick={() => exportPrestacaoRows(prestacaoVariaveis, "Variaveis", "variaveis")}
                    >
                      Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={prestacaoVariaveis.length === 0}
                      onClick={() =>
                        exportPrestacaoPdf(
                          prestacaoVariaveis,
                          "Prestação de contas — Contas variáveis",
                          prestacaoVariaveisTotal,
                        )
                      }
                    >
                      PDF
                    </Button>
                  </div>
                }
              >
                {loading ? (
                  <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
                ) : (
                  prestacaoTable(prestacaoVariaveis)
                )}
              </SectionCard>
            </>
          ) : (
          <SectionCard
            title="Lançamentos"
            description={`${entries.length} registro(s) no filtro atual.`}
            variant="elevated"
          >
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : entries.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Nenhum lançamento neste período.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Vencimento</Th>
                    <Th>Status</Th>
                    <Th>Tipo</Th>
                    <Th>Natureza</Th>
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
                        {e.kind === "SAIDA" ? (
                          <Badge
                            tone={
                              e.expenseNature === "FIXA" ? "blue" : e.expenseNature ? "zinc" : "amber"
                            }
                          >
                            {displayExpenseNature(e.kind, e.expenseNature)}
                          </Badge>
                        ) : (
                          "—"
                        )}
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
                        {(() => {
                          const files =
                            e.attachments && e.attachments.length > 0
                              ? e.attachments
                              : e.attachmentUrl
                                ? [
                                    {
                                      id: "legacy",
                                      url: e.attachmentUrl,
                                      publicId: e.attachmentPublicId,
                                      fileName: e.attachmentFileName,
                                      description: e.attachmentFileName || "Anexo",
                                    },
                                  ]
                                : [];
                          if (files.length === 0) return "—";
                          return (
                            <div className="flex flex-col gap-1">
                              {files.map((a) => {
                                const qs = a.id && a.id !== "legacy" ? `id=${encodeURIComponent(a.id)}&` : "";
                                return (
                                  <div key={a.id} className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      className="text-left text-sm text-[var(--igh-primary)] hover:underline"
                                      onClick={() => setPreview({ entryId: e.id, attachment: a })}
                                    >
                                      {a.description}
                                    </button>
                                    <a
                                      href={`/api/admin/gerencia/financeiro/lancamentos/${e.id}/anexo?${qs}download=1`}
                                      className="inline-flex rounded p-1 text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)]"
                                      title={`Baixar ${a.description}`}
                                      aria-label={`Baixar ${a.description}`}
                                    >
                                      <Download className="h-4 w-4" aria-hidden />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
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
          )}
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
        open={preview != null}
        title={preview?.attachment.description || preview?.attachment.fileName || "Anexo"}
        onClose={() => setPreview(null)}
        size="large"
      >
        {preview ? (
          attachmentPreviewKind(preview.attachment.fileName, preview.attachment.url) === "image" ? (
            <img
              src={`/api/admin/gerencia/financeiro/lancamentos/${preview.entryId}/anexo${
                preview.attachment.id && preview.attachment.id !== "legacy"
                  ? `?id=${encodeURIComponent(preview.attachment.id)}`
                  : ""
              }`}
              alt={preview.attachment.description || preview.attachment.fileName || "Anexo"}
              className="mx-auto max-h-[75vh] w-auto max-w-full rounded-md"
            />
          ) : (
            <iframe
              title={preview.attachment.description || preview.attachment.fileName || "Anexo"}
              src={`/api/admin/gerencia/financeiro/lancamentos/${preview.entryId}/anexo${
                preview.attachment.id && preview.attachment.id !== "legacy"
                  ? `?id=${encodeURIComponent(preview.attachment.id)}`
                  : ""
              }`}
              className="h-[75vh] w-full rounded-md border border-[var(--card-border)] bg-white"
            />
          )
        ) : null}
      </Modal>

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
                  setForm((prev) => ({
                    ...prev,
                    kind,
                    categoryId: "",
                    expenseNature: kind === "SAIDA" ? prev.expenseNature || "VARIAVEL" : "",
                  }));
                }}
              >
                {FINANCIAL_ENTRY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FINANCIAL_ENTRY_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {form.kind === "SAIDA" ? (
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Natureza da despesa</span>
                <select
                  className={`mt-1 ${selectClass}`}
                  value={form.expenseNature || "VARIAVEL"}
                  onChange={(e) => setField("expenseNature", e.target.value as FinancialExpenseNature)}
                >
                  {FINANCIAL_EXPENSE_NATURES.map((n) => (
                    <option key={n} value={n}>
                      {FINANCIAL_EXPENSE_NATURE_LABEL[n]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
              <div className="mt-1 flex gap-2">
                <select
                  className={selectClass}
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
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCatKind(form.kind);
                    setCatOpen(true);
                  }}
                >
                  Nova
                </Button>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Ou use o botão Categorias no topo da página.
              </p>
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
              Anexos (PDF ou imagem) — fatura, comprovante etc. Informe o que cada arquivo é e envie um a um.
              Após o envio, o sistema tenta ler valor, fornecedor, nº e data de vencimento.
            </p>
            {form.attachments.length > 0 ? (
              <ul className="space-y-2">
                {form.attachments.map((a) => (
                  <li
                    key={a.key}
                    className="flex flex-col gap-2 rounded-md border border-[var(--card-border)] p-2 sm:flex-row sm:items-center"
                  >
                    <Input
                      className="sm:max-w-xs"
                      value={a.description}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.map((item) =>
                            item.key === a.key ? { ...item, description: value } : item,
                          ),
                        }));
                      }}
                      placeholder="O que é este arquivo"
                      aria-label={`Descrição de ${a.fileName || "anexo"}`}
                    />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm text-[var(--igh-primary)] hover:underline"
                    >
                      {a.fileName || "Arquivo"}
                    </a>
                    <div className="flex flex-wrap gap-1 sm:ml-auto">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={readingInvoice}
                        onClick={() => void readInvoice(a.url, a.fileName)}
                      >
                        {readingInvoice ? "Lendo…" : "Ler nota"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            attachments: prev.attachments.filter((item) => item.key !== a.key),
                          }));
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {form.attachments.length < MAX_FINANCIAL_ATTACHMENTS ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1 text-sm">
                  <span className="text-[var(--text-muted)]">Descrição do próximo arquivo</span>
                  <Input
                    className="mt-1"
                    value={attachmentLabel}
                    onChange={(e) => setAttachmentLabel(e.target.value)}
                    placeholder="Ex.: Fatura, comprovante de pagamento"
                  />
                </label>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  disabled={uploading || readingInvoice}
                  className="text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadAttachment(file);
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Limite de {MAX_FINANCIAL_ATTACHMENTS} anexos atingido.</p>
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
                <Th></Th>
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
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="secondary" onClick={() => void toggleCategory(c)}>
                        {c.isActive ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void removeCategory(c)}>
                        Remover
                      </Button>
                    </div>
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
