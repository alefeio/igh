"use client";

import { useCallback, useState } from "react";
import { buildApimagesFormData, parseApimagesUploadJson } from "@/lib/apimages-upload";

const ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Props = {
  onUploaded: (url: string, fileName?: string) => void;
  label?: string;
  multiple?: boolean;
};

/** Upload de anexos para reportes à coordenação (Apimages). */
export function CoordinatorReportFileUpload({
  onUploaded,
  label = "Anexar arquivo",
  multiple = true,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadOne = useCallback(async (file: File): Promise<boolean> => {
    const signRes = await fetch("/api/coordinator-reports/upload-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const signJson = await signRes.json();
    if (!signRes.ok || !signJson?.ok) return false;
    const { uploadUrl, apiKey, folder } = signJson.data;

    const isImage = file.type.startsWith("image/");
    const formData = buildApimagesFormData(file, { apiKey, folder }, { resourceType: isImage ? "image" : "raw" });

    const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
    const uploadJson = await uploadRes.json();
    const parsed = parseApimagesUploadJson(uploadJson);
    if (!uploadRes.ok || parsed.errorMessage) return false;
    const url = parsed.url;
    if (url) {
      onUploaded(url, file.name);
      return true;
    }
    return false;
  }, [onUploaded]);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      const fileList = multiple ? Array.from(files) : [files[0]];
      setError(null);
      setUploading(true);
      let lastError: string | null = null;
      try {
        for (const file of fileList) {
          const ok = await uploadOne(file);
          if (!ok) lastError = lastError ?? "Falha no upload de algum arquivo.";
        }
        if (lastError) setError(lastError);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [multiple, uploadOne],
  );

  return (
    <div>
      <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
      <div className="mt-1">
        <input
          type="file"
          accept={ACCEPT}
          multiple={multiple}
          onChange={handleFile}
          disabled={uploading}
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:rounded-md file:border-0 file:bg-[var(--igh-primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </div>
      {uploading && <p className="mt-1 text-xs text-[var(--text-muted)]">Enviando…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
