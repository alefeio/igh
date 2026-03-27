"use client";

import { useCallback, useState } from "react";
import { hostedRawUrlForDownload } from "@/lib/hosted-file-url";
import { apimagesUploadHeaders, buildApimagesUploadFormData, parseApimagesUploadJson } from "@/lib/apimages-upload";

export type SiteFileUploadKind = "transparency";

type Props = {
  kind: SiteFileUploadKind;
  id?: string;
  onUploaded: (url: string) => void;
  currentUrl?: string;
  label?: string;
  accept?: string;
};

export function ApimagesFileUpload({
  kind,
  id,
  onUploaded,
  currentUrl,
  label = "Upload de arquivo (PDF)",
  accept = ".pdf,application/pdf",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        const signRes = await fetch("/api/admin/site/uploads/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, ...(id && { id }) }),
        });
        const signJson = await signRes.json();
        if (!signRes.ok || !signJson.ok) {
          setError(signJson.error?.message ?? "Falha ao obter permissão de upload.");
          return;
        }
        const { uploadUrl, apiKey } = signJson.data as { uploadUrl: string; apiKey: string };

        const formData = buildApimagesUploadFormData(file);

        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: apimagesUploadHeaders(apiKey),
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        const parsed = parseApimagesUploadJson(uploadJson);

        if (!uploadRes.ok) {
          setError(parsed.errorMessage ?? "Falha no upload.");
          return;
        }
        if (parsed.errorMessage) {
          setError(parsed.errorMessage);
          return;
        }
        if (parsed.url) {
          onUploaded(parsed.url);
        } else {
          setError("Resposta inválida do servidor de upload.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [kind, id, onUploaded],
  );

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
          />
          {uploading ? "Enviando…" : "Escolher PDF"}
        </label>
        {currentUrl && (
          <a
            href={hostedRawUrlForDownload(currentUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Ver arquivo atual
          </a>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
