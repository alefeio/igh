"use client";

import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import {
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  GERENCIA_UPLOAD_SIGNATURE,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";
import {
  EMPLOYEE_DOCUMENT_TYPE_LABEL,
  EMPLOYEE_DOCUMENT_TYPES,
  formatCentsBRL,
  formatReferenceMonth,
  type EmployeeDocumentView,
  type EmployeeView,
} from "@/lib/employees";
import type { EmployeeDocumentType } from "@/generated/prisma/client";
import {
  ALLOWED_EMPLOYEE_DOCUMENT_MIME,
  MAX_EMPLOYEE_DOCUMENT_SIZE_BYTES,
} from "@/lib/validators/employees";

type Props = {
  employee: EmployeeView;
  onUpdated: (employee: EmployeeView) => void;
};

export function EmployeeDocumentsPanel({ employee, onUpdated }: Props) {
  const toast = useToast();
  const [type, setType] = useState<EmployeeDocumentType>("RG");
  const [title, setTitle] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (!ALLOWED_EMPLOYEE_DOCUMENT_MIME.includes(file.type as (typeof ALLOWED_EMPLOYEE_DOCUMENT_MIME)[number])) {
      toast.push("error", "Aceito apenas PDF, JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_EMPLOYEE_DOCUMENT_SIZE_BYTES) {
      toast.push("error", "Arquivo deve ter no máximo 10MB.");
      return;
    }
    if (type === "NOTA_MENSAL" && !/^\d{4}-\d{2}$/.test(referenceMonth)) {
      toast.push("error", "Informe a competência da nota (mês/ano).");
      return;
    }

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

      const metaRes = await fetch(`/api/admin/gerencia/colaboradores/${employee.id}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim() || undefined,
          referenceMonth: type === "NOTA_MENSAL" ? referenceMonth : undefined,
          amount: type === "NOTA_MENSAL" && amount.trim() ? amount : undefined,
          publicId: cloud.publicId,
          url: cloud.url,
          fileName: cloud.originalFilename ?? file.name,
          mimeType: file.type,
          sizeBytes: cloud.bytes ?? file.size,
        }),
      });
      const metaJson = (await metaRes.json()) as ApiResponse<{ employee: EmployeeView }>;
      if (!metaRes.ok || !metaJson.ok) {
        toast.push("error", !metaJson.ok ? metaJson.error.message : "Falha ao registrar documento.");
        return;
      }

      onUpdated(metaJson.data.employee);
      setTitle("");
      setAmount("");
      toast.push("success", "Documento anexado.");
    } catch {
      toast.push("error", "Falha ao anexar documento.");
    } finally {
      setUploading(false);
    }
  }

  async function removeDocument(doc: EmployeeDocumentView) {
    if (!window.confirm(`Remover o documento "${EMPLOYEE_DOCUMENT_TYPE_LABEL[doc.type]}"?`)) return;
    setRemovingId(doc.id);
    try {
      const res = await fetch(
        `/api/admin/gerencia/colaboradores/${employee.id}/documentos/${doc.id}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as ApiResponse<{ employee: EmployeeView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao remover.");
        return;
      }
      onUpdated(json.data.employee);
      toast.push("success", "Documento removido.");
    } catch {
      toast.push("error", "Falha ao remover documento.");
    } finally {
      setRemovingId(null);
    }
  }

  const missing = employee.missingDocuments;

  return (
    <div className="space-y-4">
      {missing.length > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Pendentes: {missing.map((t) => EMPLOYEE_DOCUMENT_TYPE_LABEL[t]).join(", ")}
        </p>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Documentos obrigatórios em dia.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--text-muted)]">Tipo</span>
          <select
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value as EmployeeDocumentType)}
          >
            {EMPLOYEE_DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYEE_DOCUMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--text-muted)]">Título (opcional)</span>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {type === "NOTA_MENSAL" ? (
          <>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Competência</span>
              <Input
                className="mt-1"
                type="month"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Valor (R$)</span>
              <Input
                className="mt-1"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>

      <label className="inline-flex cursor-pointer">
        <span className="sr-only">Selecionar arquivo</span>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          disabled={uploading}
          className="block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadFile(file);
          }}
        />
      </label>
      {uploading ? <p className="text-sm text-[var(--text-muted)]">Enviando…</p> : null}

      <ul className="divide-y divide-[var(--card-border)] rounded-md border border-[var(--card-border)]">
        {employee.documents.length === 0 ? (
          <li className="px-3 py-4 text-sm text-[var(--text-muted)]">Nenhum documento anexado.</li>
        ) : (
          employee.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{EMPLOYEE_DOCUMENT_TYPE_LABEL[doc.type]}</Badge>
                  {doc.type === "NOTA_MENSAL" ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatReferenceMonth(doc.referenceMonth)} · {formatCentsBRL(doc.amountCents)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-[var(--text-primary)]">
                  {doc.title || doc.fileName || "Arquivo"}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-md border border-[var(--card-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--igh-surface)]"
                >
                  Abrir
                </a>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={removingId === doc.id}
                  onClick={() => void removeDocument(doc)}
                >
                  Remover
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
