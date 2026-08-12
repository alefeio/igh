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

type Submission = {
  id: string;
  referenceMonthLabel: string;
  amountLabel: string;
  description: string | null;
  supplier: string | null;
  fileUrl: string;
  fileName: string | null;
  status: "PENDENTE" | "APROVADA" | "RECUSADA";
  reviewNotes: string | null;
  createdAt: string;
};

type InvoiceSuggestion = {
  amount?: string;
  supplier?: string;
  description?: string;
  invoiceNumber?: string;
  entryDate?: string;
};

const STATUS_LABEL: Record<Submission["status"], string> = {
  PENDENTE: "Em análise",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
};

const STATUS_TONE: Record<Submission["status"], "amber" | "green" | "red"> = {
  PENDENTE: "amber",
  APROVADA: "green",
  RECUSADA: "red",
};

export default function ColaboradorNotasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [form, setForm] = useState({
    referenceMonth: new Date().toISOString().slice(0, 7),
    amount: "",
    description: "",
    supplier: "",
    invoiceNumber: "",
    fileUrl: "",
    filePublicId: "",
    fileName: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/colaborador/notas", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ submissions: Submission[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar as notas.");
        return;
      }
      setSubmissions(json.data.submissions);
    } catch {
      toast.push("error", "Falha ao carregar as notas.");
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
        referenceMonth: s.entryDate?.slice(0, 7) || prev.referenceMonth,
      }));
      toast.push("success", "Dados da nota preenchidos. Confira antes de enviar.");
    } catch {
      // leitura é auxiliar
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
    if (!form.fileUrl) {
      toast.push("error", "Anexe o arquivo da nota.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/colaborador/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceMonth: form.referenceMonth,
          amount: form.amount || null,
          description: form.description || null,
          supplier: form.supplier || null,
          invoiceNumber: form.invoiceNumber || null,
          fileUrl: form.fileUrl,
          filePublicId: form.filePublicId || null,
          fileName: form.fileName || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ submission: Submission }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao enviar a nota.");
        return;
      }
      toast.push("success", "Nota enviada para a gerência.");
      setForm({
        referenceMonth: new Date().toISOString().slice(0, 7),
        amount: "",
        description: "",
        supplier: "",
        invoiceNumber: "",
        fileUrl: "",
        filePublicId: "",
        fileName: "",
      });
      void load();
    } catch {
      toast.push("error", "Falha ao enviar a nota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Portal do colaborador"
        title="Enviar nota"
        description="Toda NF do mês (MEI/prestador) deve ser enviada até o último dia do mês. A gerência também pode registrar por você."
      />

      <SectionCard title="Nova nota" variant="elevated">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Competência</span>
            <Input
              type="month"
              value={form.referenceMonth}
              onChange={(e) => setForm((f) => ({ ...f, referenceMonth: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Valor (R$)</span>
            <Input
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0,00"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Estabelecimento</span>
            <Input
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Nº da nota</span>
            <Input
              value={form.invoiceNumber}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Descrição</span>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
            <Button type="button" variant="secondary" disabled={uploading}>
              {uploading ? "Enviando…" : form.fileUrl ? "Trocar arquivo" : "Anexar PDF ou imagem"}
            </Button>
          </label>
          {form.fileName ? (
            <span className="text-sm text-[var(--text-muted)]">{form.fileName}</span>
          ) : null}
          {reading ? <span className="text-sm text-[var(--text-muted)]">Lendo a nota…</span> : null}
          <Button type="button" onClick={() => void submit()} disabled={saving || !form.fileUrl}>
            {saving ? "Enviando…" : "Enviar para a gerência"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Envios anteriores" variant="elevated">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma nota enviada ainda.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Competência</Th>
                <Th>Valor</Th>
                <Th>Status</Th>
                <Th>Arquivo</Th>
                <Th>Obs. da gerência</Th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <Td>{s.referenceMonthLabel}</Td>
                  <Td>{s.amountLabel}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                  </Td>
                  <Td>
                    <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-[var(--igh-primary)] underline">
                      {s.fileName || "Abrir"}
                    </a>
                  </Td>
                  <Td>{s.reviewNotes || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>
    </PanelPageStack>
  );
}
