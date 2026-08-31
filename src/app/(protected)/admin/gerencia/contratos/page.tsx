"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
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
  employeePositionText,
  formatCentsBRL,
  formatCpf,
  formatReferenceMonth,
  type EmployeeView,
} from "@/lib/employees";

type Tab = "contratacao" | "distratos" | "notas";

type Template = { id: string; type: string; title: string; isActive: boolean };

type Contract = {
  id: string;
  kind: "CONTRATO" | "DISTRATO";
  status: string;
  startDate: string;
  endDate: string | null;
  monthlyValueCents: number | null;
  pdfUrl: string | null;
  signedPdfUrl: string | null;
  employee: {
    id: string;
    name: string;
    cpf: string;
    position: EmployeeView["position"];
    positionLabel: string | null;
    status: string;
  };
  template: { id: string; title: string; type: string } | null;
};

type Invoice = {
  id: string;
  referenceMonth: string;
  amountCents: number | null;
  status: string;
  pdfUrl: string | null;
  employee: {
    id: string;
    name: string;
    cpf: string;
    position: EmployeeView["position"];
    positionLabel: string | null;
  };
};

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
  PENDENTE: "Pendente",
  ENTREGUE: "Entregue",
  ATRASADA: "Atrasada",
};

export default function ContratosPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("contratacao");
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [employees, setEmployees] = useState<EmployeeView[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"CONTRATO" | "DISTRATO">("CONTRATO");
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [parentContractId, setParentContractId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [saving, setSaving] = useState(false);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceEmployeeId, setInvoiceEmployeeId] = useState("");
  const [invoiceMonth, setInvoiceMonth] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const signedFileRef = useRef<HTMLInputElement>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [previewContract, setPreviewContract] = useState<{
    id: string;
    label: string;
    variant: "generated" | "signed";
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, iRes, eRes, tRes] = await Promise.all([
        fetch("/api/admin/gerencia/contratos", { cache: "no-store" }),
        fetch("/api/admin/gerencia/notas-mensais", { cache: "no-store" }),
        fetch("/api/admin/gerencia/colaboradores", { cache: "no-store" }),
        fetch("/api/admin/gerencia/modelos", { cache: "no-store" }),
      ]);
      const cJson = (await cRes.json()) as ApiResponse<{ contracts: Contract[] }>;
      const iJson = (await iRes.json()) as ApiResponse<{ invoices: Invoice[] }>;
      const eJson = (await eRes.json()) as ApiResponse<{ employees: EmployeeView[] }>;
      const tJson = (await tRes.json()) as ApiResponse<{ templates: Template[] }>;
      if (cRes.ok && cJson.ok) setContracts(cJson.data.contracts);
      else toast.push("error", !cJson.ok ? cJson.error.message : "Falha ao carregar contratos.");
      if (iRes.ok && iJson.ok) setInvoices(iJson.data.invoices);
      else toast.push("error", !iJson.ok ? iJson.error.message : "Falha ao carregar notas mensais.");
      if (eRes.ok && eJson.ok) setEmployees(eJson.data.employees);
      if (tRes.ok && tJson.ok) setTemplates(tJson.data.templates.filter((t) => t.isActive));
    } catch {
      toast.push("error", "Falha ao carregar contratos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const contratacoes = useMemo(
    () => contracts.filter((c) => c.kind === "CONTRATO"),
    [contracts],
  );
  const distratos = useMemo(() => contracts.filter((c) => c.kind === "DISTRATO"), [contracts]);

  const filteredContratos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = search.replace(/\D/g, "");
    const list = tab === "distratos" ? distratos : contratacoes;
    if (!q && !digits) return list;
    return list.filter((c) => {
      const hay = `${c.employee.name} ${employeePositionText(c.employee)} ${c.employee.cpf}`.toLowerCase();
      return (q && hay.includes(q)) || (digits && c.employee.cpf.includes(digits));
    });
  }, [tab, contratacoes, distratos, search]);

  const templatesForKind = templates.filter((t) =>
    kind === "DISTRATO" ? t.type === "DISTRATO" : t.type === "CONTRATO",
  );

  const activeContractsForEmployee = useMemo(
    () =>
      contratacoes.filter(
        (c) => c.employee.id === employeeId && (c.status === "ATIVO" || c.status === "RASCUNHO"),
      ),
    [contratacoes, employeeId],
  );

  function openCreate(nextKind: "CONTRATO" | "DISTRATO") {
    setKind(nextKind);
    setEmployeeId(employees[0]?.id ?? "");
    setTemplateId("");
    setParentContractId("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setMonthlyValue("");
    setOpen(true);
  }

  async function saveContract() {
    if (!employeeId || !templateId || !startDate) {
      toast.push("error", "Selecione colaborador, modelo e data de início.");
      return;
    }
    if (kind === "DISTRATO" && !parentContractId) {
      toast.push("error", "Selecione o contrato original do distrato.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          templateId,
          kind,
          parentContractId: kind === "DISTRATO" ? parentContractId : null,
          startDate,
          endDate: endDate || null,
          monthlyValue: monthlyValue || null,
          status: "ATIVO",
          generatePdf: true,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ contract: Contract }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao emitir documento.");
        return;
      }
      toast.push("success", kind === "DISTRATO" ? "Distrato emitido." : "Contrato emitido.");
      setOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha ao emitir documento.");
    } finally {
      setSaving(false);
    }
  }

  async function saveInvoice() {
    if (!invoiceEmployeeId || !invoiceMonth) {
      toast.push("error", "Informe colaborador e competência.");
      return;
    }
    setInvoiceSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/notas-mensais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: invoiceEmployeeId,
          referenceMonth: invoiceMonth,
          amount: invoiceAmount || null,
          status: "ENTREGUE",
        }),
      });
      const json = (await res.json()) as ApiResponse<{ invoice: Invoice }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao registrar nota.");
        return;
      }
      toast.push("success", "Nota mensal registrada.");
      setInvoiceOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha ao registrar nota.");
    } finally {
      setInvoiceSaving(false);
    }
  }

  function pickSignedPdf(contractId: string) {
    setPendingUploadId(contractId);
    signedFileRef.current?.click();
  }

  async function uploadSignedPdf(file: File, contractId: string) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.push("error", "Envie um arquivo PDF.");
      return;
    }
    setUploadingId(contractId);
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
        toast.push("error", cloud.errorMessage ?? "Falha no upload do PDF.");
        return;
      }
      const res = await fetch(`/api/admin/gerencia/contratos/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedPdfUrl: cloud.url,
          signedPdfPublicId: cloud.publicId || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ contract: Contract }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar PDF assinado.");
        return;
      }
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contractId
            ? { ...c, signedPdfUrl: json.data.contract.signedPdfUrl }
            : c,
        ),
      );
      toast.push("success", "PDF assinado anexado.");
    } catch {
      toast.push("error", "Falha ao anexar PDF assinado.");
    } finally {
      setUploadingId(null);
      setPendingUploadId(null);
    }
  }

  async function archiveContract(c: Contract) {
    if (!confirm(`Arquivar o documento de ${c.employee.name}?`)) return;
    const res = await fetch(`/api/admin/gerencia/contratos/${c.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao arquivar.");
      return;
    }
    toast.push("success", "Documento arquivado.");
    void load();
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        tab === id
          ? "bg-[var(--igh-primary)] text-white"
          : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Administração · Pessoas"
        title="Contratos"
        description="Emita contratações e distratos no modelo oficial e anexe o PDF assinado."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openCreate("DISTRATO")}>
              Emitir distrato
            </Button>
            <Button onClick={() => openCreate("CONTRATO")}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Nova contratação
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabBtn("contratacao", "Contratação")}
        {tabBtn("distratos", "Distratos")}
        {tabBtn("notas", "Notas mensais")}
      </div>

      {tab !== "notas" ? (
        <SectionCard
          title={tab === "distratos" ? "Histórico de distratos" : "Histórico de contratações"}
          description={
            tab === "distratos"
              ? "Documentos já emitidos e disponíveis para consulta."
              : `${filteredContratos.length} contrato(s) encontrado(s).`
          }
          variant="elevated"
          action={
            <Input
              className="w-56"
              placeholder="Buscar nome, cargo ou CPF"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
        >
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : filteredContratos.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              {tab === "distratos" ? "Nenhum distrato emitido." : "Nenhum contrato encontrado."}
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Cargo</Th>
                  <Th>Início</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                  <Th>PDF</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filteredContratos.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <div className="font-medium">{c.employee.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{formatCpf(c.employee.cpf)}</div>
                    </Td>
                    <Td>{employeePositionText(c.employee)}</Td>
                    <Td className="whitespace-nowrap">{c.startDate.split("-").reverse().join("/")}</Td>
                    <Td>{formatCentsBRL(c.monthlyValueCents)}</Td>
                    <Td>
                      <Badge tone={c.status === "ATIVO" ? "green" : "zinc"}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1 text-sm">
                        {c.pdfUrl ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-auto px-0 py-0 font-medium text-[var(--igh-primary)]"
                              onClick={() =>
                                setPreviewContract({
                                  id: c.id,
                                  label: `${c.employee.name} — contrato gerado`,
                                  variant: "generated",
                                })
                              }
                            >
                              Visualizar
                            </Button>
                            <a
                              href={`/api/admin/gerencia/contratos/${c.id}/pdf?download=1`}
                              className="text-[var(--text-muted)] hover:text-[var(--igh-primary)] hover:underline"
                            >
                              Baixar
                            </a>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">Sem gerado</span>
                        )}
                        {c.signedPdfUrl ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-auto px-0 py-0 font-medium text-emerald-700 dark:text-emerald-400"
                              onClick={() =>
                                setPreviewContract({
                                  id: c.id,
                                  label: `${c.employee.name} — contrato assinado`,
                                  variant: "signed",
                                })
                              }
                            >
                              Visualizar assinado
                            </Button>
                            <a
                              href={`/api/admin/gerencia/contratos/${c.id}/pdf?variant=signed&download=1`}
                              className="text-emerald-700 hover:underline dark:text-emerald-400"
                            >
                              Baixar
                            </a>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={uploadingId === c.id}
                            onClick={() => pickSignedPdf(c.id)}
                          >
                            {uploadingId === c.id ? "Enviando…" : "Anexar assinado"}
                          </Button>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <Button size="sm" variant="ghost" onClick={() => void archiveContract(c)}>
                        Arquivar
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Notas mensais"
          description="Acompanhe a entrega das notas por competência."
          variant="elevated"
          action={
            <Button
              onClick={() => {
                setInvoiceEmployeeId(employees[0]?.id ?? "");
                setInvoiceMonth(new Date().toISOString().slice(0, 7));
                setInvoiceAmount("");
                setInvoiceOpen(true);
              }}
            >
              Registrar nota
            </Button>
          }
        >
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma nota registrada.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Competência</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                  <Th>PDF</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <Td>
                      <div className="font-medium">{inv.employee.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{formatCpf(inv.employee.cpf)}</div>
                    </Td>
                    <Td>{formatReferenceMonth(inv.referenceMonth)}</Td>
                    <Td>{formatCentsBRL(inv.amountCents)}</Td>
                    <Td>
                      <Badge tone={inv.status === "ENTREGUE" ? "green" : "amber"}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </Td>
                    <Td>
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                        >
                          Abrir
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      )}

      <Modal
        open={previewContract != null}
        title={previewContract?.label ?? "Contrato"}
        onClose={() => setPreviewContract(null)}
        size="large"
      >
        {previewContract ? (
          <iframe
            title={previewContract.label}
            src={`/api/admin/gerencia/contratos/${previewContract.id}/pdf${
              previewContract.variant === "signed" ? "?variant=signed" : ""
            }`}
            className="h-[75vh] w-full rounded-md border border-[var(--card-border)] bg-white"
          />
        ) : null}
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={kind === "DISTRATO" ? "Emitir distrato" : "Nova contratação"}
        size="large"
      >
        <div className="space-y-4">
          {templatesForKind.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Não há modelo ativo de {kind === "DISTRATO" ? "distrato" : "contrato"}. Crie um em{" "}
              <a href="/admin/gerencia/modelos" className="font-medium underline">
                Modelos oficiais
              </a>
              .
            </p>
          ) : null}
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Colaborador</span>
            <select
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setParentContractId("");
              }}
            >
              <option value="">Selecione</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {formatCpf(e.cpf)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Modelo</span>
            <select
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Selecione</option>
              {templatesForKind.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          {kind === "DISTRATO" ? (
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Contrato original</span>
              <select
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
                value={parentContractId}
                onChange={(e) => setParentContractId(e.target.value)}
              >
                <option value="">Selecione</option>
                {activeContractsForEmployee.map((c) => (
                  <option key={c.id} value={c.id}>
                    Início {c.startDate.split("-").reverse().join("/")} · {STATUS_LABEL[c.status]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Data de início / emissão</span>
              <Input
                className="mt-1"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Data fim (opcional)</span>
              <Input
                className="mt-1"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            {kind === "CONTRATO" ? (
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Valor mensal (R$)</span>
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  value={monthlyValue}
                  onChange={(e) => setMonthlyValue(e.target.value)}
                  placeholder="0,00"
                />
              </label>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveContract()} disabled={saving || templatesForKind.length === 0}>
              {saving ? "Gerando PDF…" : "Emitir e gerar PDF"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} title="Registrar nota mensal">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Colaborador</span>
            <select
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
              value={invoiceEmployeeId}
              onChange={(e) => setInvoiceEmployeeId(e.target.value)}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
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
                value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Valor (R$)</span>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInvoiceOpen(false)} disabled={invoiceSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveInvoice()} disabled={invoiceSaving}>
              {invoiceSaving ? "Salvando…" : "Registrar"}
            </Button>
          </div>
        </div>
      </Modal>

      <input
        ref={signedFileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const id = pendingUploadId;
          e.target.value = "";
          if (file && id) void uploadSignedPdf(file, id);
        }}
      />
    </PanelPageStack>
  );
}
