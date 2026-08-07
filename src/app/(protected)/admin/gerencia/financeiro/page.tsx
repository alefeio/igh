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
import {
  FINANCIAL_ENTRY_KIND_LABEL,
  FINANCIAL_ENTRY_KINDS,
  FINANCIAL_PAYMENT_METHOD_LABEL,
  FINANCIAL_PAYMENT_METHODS,
  formatCentsBRL,
  formatEntryDate,
  responsibleLabel,
  type FinancialCategoryView,
  type FinancialEntryView,
} from "@/lib/financeiro";
import type { FinancialEntryKind, FinancialPaymentMethod } from "@/generated/prisma/client";

type PoloOption = { id: string; name: string };
type UserOption = { id: string; name: string; email: string };
type Totals = { entradasCents: number; saidasCents: number; saldoCents: number };

type EntryForm = {
  kind: FinancialEntryKind;
  description: string;
  amount: string;
  entryDate: string;
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

function emptyForm(): EntryForm {
  return {
    kind: "SAIDA",
    description: "",
    amount: "",
    entryDate: new Date().toISOString().slice(0, 10),
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

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

export default function FinanceiroPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<FinancialEntryView[]>([]);
  const [totals, setTotals] = useState<Totals>({ entradasCents: 0, saidasCents: 0, saldoCents: 0 });
  const [categories, setCategories] = useState<FinancialCategoryView[]>([]);
  const [polos, setPolos] = useState<PoloOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [kindFilter, setKindFilter] = useState<"" | FinancialEntryKind>("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [poloFilter, setPoloFilter] = useState("");
  const [q, setQ] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntryView | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<FinancialEntryKind>("SAIDA");
  const [catSaving, setCatSaving] = useState(false);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (month) sp.set("month", month);
    if (kindFilter) sp.set("kind", kindFilter);
    if (categoryFilter) sp.set("categoryId", categoryFilter);
    if (poloFilter) sp.set("poloId", poloFilter);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [month, kindFilter, categoryFilter, poloFilter, q]);

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
      }>;
      const cJson = (await cRes.json()) as ApiResponse<{ categories: FinancialCategoryView[] }>;
      const oJson = (await oRes.json()) as ApiResponse<{ users: UserOption[]; polos: PoloOption[] }>;

      if (!eRes.ok || !eJson.ok) {
        toast.push("error", !eJson.ok ? eJson.error.message : "Falha ao carregar lançamentos.");
        return;
      }
      setEntries(eJson.data.entries);
      setTotals(eJson.data.totals);
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

  useEffect(() => {
    void load();
  }, [load]);

  const categoriesForForm = useMemo(
    () => categories.filter((c) => c.isActive && c.kind === form.kind),
    [categories, form.kind],
  );

  const categoriesForFilter = useMemo(
    () =>
      categories.filter(
        (c) => c.isActive && (!kindFilter || c.kind === kindFilter),
      ),
    [categories, kindFilter],
  );

  function setField<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate(kind: FinancialEntryKind = "SAIDA") {
    setEditing(null);
    setForm({ ...emptyForm(), kind });
    setFormOpen(true);
  }

  function openEdit(entry: FinancialEntryView) {
    setEditing(entry);
    setForm({
      kind: entry.kind,
      description: entry.description,
      amount: (entry.amountCents / 100).toFixed(2).replace(".", ","),
      entryDate: entry.entryDate,
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
      setForm((prev) => ({
        ...prev,
        attachmentUrl: cloud.url!,
        attachmentPublicId: cloud.publicId,
        attachmentFileName: cloud.originalFilename ?? file.name,
      }));
      toast.push("success", "Anexo enviado.");
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
      const body = {
        kind: form.kind,
        description: form.description,
        amount: form.amount,
        entryDate: form.entryDate,
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
      void load();
    } catch {
      toast.push("error", "Falha ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
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
      Data: formatEntryDate(e.entryDate),
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
        <th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Responsável</th>
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

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Financeiro"
        title="Entradas e saídas"
        description="Registre notas com descrição, valor e responsável. Filtre por mês, categoria e polo."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCatOpen(true)}>
              Categorias
            </Button>
            <Button variant="secondary" onClick={exportXlsx} disabled={entries.length === 0}>
              Excel
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={entries.length === 0}>
              PDF
            </Button>
            <Button onClick={() => openCreate("SAIDA")}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Novo lançamento
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Entradas" value={formatCentsBRL(totals.entradasCents)} icon={ArrowUpCircle} accent="emerald" />
        <StatTile label="Saídas" value={formatCentsBRL(totals.saidasCents)} icon={ArrowDownCircle} accent="rose" />
        <StatTile label="Saldo" value={formatCentsBRL(totals.saldoCents)} icon={Scale} accent="sky" />
      </div>

      <SectionCard title="Filtros" variant="elevated">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Mês</span>
            <Input className="mt-1" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Tipo</span>
            <select className={`mt-1 ${selectClass}`} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "" | FinancialEntryKind)}>
              <option value="">Todos</option>
              {FINANCIAL_ENTRY_KINDS.map((k) => (
                <option key={k} value={k}>{FINANCIAL_ENTRY_KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Categoria</span>
            <select className={`mt-1 ${selectClass}`} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Todas</option>
              {categoriesForFilter.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Polo</span>
            <select className={`mt-1 ${selectClass}`} value={poloFilter} onChange={(e) => setPoloFilter(e.target.value)}>
              <option value="">Todos</option>
              {polos.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Busca</span>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
              <Input className="pl-9" placeholder="Descrição, nota, fornecedor…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Lançamentos" description={`${entries.length} registro(s) no filtro atual.`} variant="elevated">
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
                <Th>Data</Th>
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
                      <a href={e.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--igh-primary)] hover:underline">
                        Abrir
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(e)}>Editar</Button>
                      <Button size="sm" variant="danger" onClick={() => void archiveEntry(e)}>Arquivar</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Editar lançamento" : "Novo lançamento"} size="large">
        <div className="space-y-4">
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
                  <option key={k} value={k}>{FINANCIAL_ENTRY_KIND_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Data</span>
              <Input className="mt-1" type="date" value={form.entryDate} onChange={(e) => setField("entryDate", e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">Descrição *</span>
              <Input className="mt-1" value={form.description} onChange={(e) => setField("description", e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Valor (R$) *</span>
              <Input className="mt-1" inputMode="decimal" value={form.amount} onChange={(e) => setField("amount", e.target.value)} placeholder="0,00" />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Categoria</span>
              <select className={`mt-1 ${selectClass}`} value={form.categoryId} onChange={(e) => setField("categoryId", e.target.value)}>
                <option value="">Sem categoria</option>
                {categoriesForForm.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Forma de pagamento</span>
              <select className={`mt-1 ${selectClass}`} value={form.paymentMethod} onChange={(e) => setField("paymentMethod", e.target.value as FinancialPaymentMethod)}>
                {FINANCIAL_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{FINANCIAL_PAYMENT_METHOD_LABEL[m]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Polo</span>
              <select className={`mt-1 ${selectClass}`} value={form.poloId} onChange={(e) => setField("poloId", e.target.value)}>
                <option value="">Sem polo</option>
                {polos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Responsável (usuário)</span>
              <select className={`mt-1 ${selectClass}`} value={form.responsibleUserId} onChange={(e) => setField("responsibleUserId", e.target.value)}>
                <option value="">Nome livre abaixo</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Responsável (nome livre)</span>
              <Input className="mt-1" value={form.responsibleName} onChange={(e) => setField("responsibleName", e.target.value)} placeholder="Se não tiver conta no sistema" />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Nº da nota</span>
              <Input className="mt-1" value={form.invoiceNumber} onChange={(e) => setField("invoiceNumber", e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Fornecedor / origem</span>
              <Input className="mt-1" value={form.supplier} onChange={(e) => setField("supplier", e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">Observações</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2">
            {/*
              TODO (leitura de NF): ao anexar PDF/imagem da nota, extrair o que for possível
              (valor, estabelecimento/fornecedor, descrição, nº, data) e pré-preencher o formulário.
              Sempre exigir revisão e confirmação explícita do usuário antes de salvar.
            */}
            <p className="text-sm text-[var(--text-muted)]">Anexo da nota (PDF ou imagem)</p>
            {form.attachmentUrl ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <a href={form.attachmentUrl} target="_blank" rel="noreferrer" className="text-[var(--igh-primary)] hover:underline">
                  {form.attachmentFileName || "Arquivo anexado"}
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      attachmentUrl: "",
                      attachmentPublicId: "",
                      attachmentFileName: "",
                    }))
                  }
                >
                  Remover
                </Button>
              </div>
            ) : (
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadAttachment(file);
                }}
              />
            )}
            {uploading ? <p className="text-sm text-[var(--text-muted)]">Enviando anexo…</p> : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveEntry()} disabled={saving || uploading}>
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
              <select className={`mt-1 ${selectClass}`} value={catKind} onChange={(e) => setCatKind(e.target.value as FinancialEntryKind)}>
                {FINANCIAL_ENTRY_KINDS.map((k) => (
                  <option key={k} value={k}>{FINANCIAL_ENTRY_KIND_LABEL[k]}</option>
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
