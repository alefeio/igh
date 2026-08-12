"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import {
  COLABORADOR_UPLOAD_SIGNATURE,
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";

type DriverKind = "QUILOMETRAGEM" | "NOTA_SERVICO" | "OCORRENCIA";

type DriverLog = {
  id: string;
  kind: DriverKind;
  occurredAt: string;
  odometerKm: number | null;
  description: string;
  amountLabel: string | null;
  supplier: string | null;
  fileUrl: string | null;
  fileName: string | null;
  status: "PENDENTE" | "VISTO";
  reviewNotes: string | null;
  financialEntryId: string | null;
  createdAt: string;
};

type InvoiceSuggestion = {
  amount?: string;
  supplier?: string;
  description?: string;
  invoiceNumber?: string;
  entryDate?: string;
};

const KIND_LABEL: Record<DriverKind, string> = {
  QUILOMETRAGEM: "Quilometragem",
  NOTA_SERVICO: "Nota de serviço",
  OCORRENCIA: "Ocorrência",
};

const emptyForm = {
  occurredAt: new Date().toISOString().slice(0, 10),
  odometerKm: "",
  description: "",
  amount: "",
  supplier: "",
  invoiceNumber: "",
  fileUrl: "",
  filePublicId: "",
  fileName: "",
};

export default function ColaboradorMotoristaPage() {
  const toast = useToast();
  const [tab, setTab] = useState<DriverKind>("QUILOMETRAGEM");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [logs, setLogs] = useState<DriverLog[]>([]);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/colaborador/motorista", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ logs: DriverLog[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar registros.");
        return;
      }
      setLogs(json.data.logs);
    } catch {
      toast.push("error", "Falha ao carregar registros.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function readInvoice(attachmentUrl: string, attachmentFileName: string) {
    setReading(true);
    try {
      const res = await fetch("/api/me/colaborador/notas/ler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentUrl, attachmentFileName }),
      });
      const json = (await res.json()) as ApiResponse<{ suggestion: InvoiceSuggestion }>;
      if (!res.ok || !json.ok) return;
      const s = json.data.suggestion;
      setForm((prev) => ({
        ...prev,
        amount: prev.amount || s.amount || "",
        supplier: prev.supplier || s.supplier || "",
        description: prev.description || s.description || "",
        invoiceNumber: prev.invoiceNumber || s.invoiceNumber || "",
        occurredAt: s.entryDate?.slice(0, 10) || prev.occurredAt,
      }));
      toast.push("success", "Dados da nota preenchidos. Confira antes de enviar.");
    } catch {
      // leitura auxiliar
    } finally {
      setReading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const signRes = await fetch(COLABORADOR_UPLOAD_SIGNATURE, { method: "POST" });
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
      const fileName = cloud.originalFilename ?? file.name;
      setForm((prev) => ({
        ...prev,
        fileUrl: cloud.url!,
        filePublicId: cloud.publicId,
        fileName,
      }));
      toast.push("success", "Arquivo anexado.");
      void readInvoice(cloud.url, fileName);
    } catch {
      toast.push("error", "Falha ao anexar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!form.description.trim()) {
      toast.push("error", "Informe a descrição.");
      return;
    }
    if (tab === "NOTA_SERVICO" && !form.fileUrl) {
      toast.push("error", "Anexe o arquivo da nota de serviço.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me/colaborador/motorista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: tab,
          occurredAt: form.occurredAt,
          odometerKm: form.odometerKm ? Number(form.odometerKm) : null,
          description: form.description.trim(),
          amount: form.amount || null,
          supplier: form.supplier || null,
          invoiceNumber: form.invoiceNumber || null,
          fileUrl: form.fileUrl || null,
          filePublicId: form.filePublicId || null,
          fileName: form.fileName || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ log: DriverLog }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao enviar o registro.");
        return;
      }
      toast.push("success", "Registro enviado à gerência.");
      setForm(emptyForm);
      void load();
    } catch {
      toast.push("error", "Falha ao enviar o registro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Portal do colaborador"
        title="Registros do motorista"
        description="Informe quilometragem, notas de serviço e ocorrências para a gerência."
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as DriverKind[]).map((k) => (
          <Button
            key={k}
            type="button"
            variant={tab === k ? "primary" : "secondary"}
            onClick={() => setTab(k)}
          >
            {KIND_LABEL[k]}
          </Button>
        ))}
      </div>

      <SectionCard title={`Novo: ${KIND_LABEL[tab]}`} variant="elevated">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-[var(--text-muted)]">
            Data
            <Input
              className="mt-1"
              type="date"
              value={form.occurredAt}
              onChange={(e) => setForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
            />
          </label>
          {tab === "QUILOMETRAGEM" ? (
            <label className="text-xs text-[var(--text-muted)]">
              Odômetro (km)
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={form.odometerKm}
                onChange={(e) => setForm((prev) => ({ ...prev, odometerKm: e.target.value }))}
              />
            </label>
          ) : null}
          {tab === "NOTA_SERVICO" ? (
            <>
              <label className="text-xs text-[var(--text-muted)]">
                Valor (R$)
                <Input
                  className="mt-1"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="0,00"
                />
              </label>
              <label className="text-xs text-[var(--text-muted)]">
                Fornecedor
                <Input
                  className="mt-1"
                  value={form.supplier}
                  onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
                />
              </label>
              <label className="text-xs text-[var(--text-muted)]">
                Nº da nota
                <Input
                  className="mt-1"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                />
              </label>
              <div className="text-xs text-[var(--text-muted)]">
                Arquivo
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadFile(file);
                      }}
                    />
                    <Button type="button" variant="secondary" disabled={uploading || reading}>
                      {uploading ? "Enviando…" : reading ? "Lendo nota…" : "Anexar arquivo"}
                    </Button>
                  </label>
                  {form.fileName ? (
                    <span className="text-sm text-[var(--text-primary)]">{form.fileName}</span>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
          <label className="text-xs text-[var(--text-muted)] md:col-span-2">
            Descrição
            <textarea
              className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={
                tab === "QUILOMETRAGEM"
                  ? "Ex.: Percurso sede → polo"
                  : tab === "OCORRENCIA"
                    ? "Descreva a ocorrência"
                    : "Descrição do serviço"
              }
            />
          </label>
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => void submit()} disabled={saving || loading}>
            {saving ? "Enviando…" : "Enviar registro"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Histórico" description={loading ? "Carregando…" : undefined} variant="elevated">
        {logs.length === 0 && !loading ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum registro enviado ainda.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Detalhes</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {log.occurredAt.split("-").reverse().join("/")}
                  </Td>
                  <Td>{KIND_LABEL[log.kind]}</Td>
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
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>
    </PanelPageStack>
  );
}
