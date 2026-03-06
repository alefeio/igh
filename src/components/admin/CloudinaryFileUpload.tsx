"use client";

import { useCallback, useState } from "react";
import { cloudinaryRawUrlForDownload } from "@/lib/cloudinary-url";

export type SiteFileUploadKind = "transparency";

type Props = {
  kind: SiteFileUploadKind;
  id?: string;
  onUploaded: (url: string) => void;
  currentUrl?: string;
  label?: string;
  accept?: string;
};

export function CloudinaryFileUpload({
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
          setError(signJson.error?.message ?? "Falha ao obter assinatura.");
          return;
        }
        const { timestamp, signature, apiKey, cloudName, folder, use_filename } = signJson.data;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", apiKey);
        formData.append("timestamp", String(timestamp));
        formData.append("signature", signature);
        formData.append("folder", folder);
        formData.append("resource_type", "raw");
        if (use_filename) formData.append("use_filename", "true");

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: "POST",
          body: formData,
        });
        const uploadJson = (await uploadRes.json()) as {
          secure_url?: string;
          error?: { message?: string };
          message?: string;
        };
        if (!uploadRes.ok) {
          const errMsg =
            uploadJson.error?.message ??
            uploadJson.message ??
            (typeof uploadJson === "object" && uploadJson !== null && "error" in uploadJson
              ? String((uploadJson as { error?: string }).error)
              : "Falha no upload.");
          setError(errMsg);
          return;
        }
        if (uploadJson.error) {
          setError(uploadJson.error.message ?? uploadJson.message ?? "Falha no upload.");
          return;
        }
        if (uploadJson.secure_url) {
          onUploaded(uploadJson.secure_url);
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
    [kind, id, onUploaded]
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
            href={cloudinaryRawUrlForDownload(currentUrl)}
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
