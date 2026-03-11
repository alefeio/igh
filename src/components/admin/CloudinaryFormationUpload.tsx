"use client";

import { useCallback, useState } from "react";

const FORMATIONS_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Props = {
  onUploaded: (url: string) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
};

/**
 * Upload para pasta "formations": imagens vão em image/upload, demais arquivos em raw/upload.
 * Aceita imagens, PDF, Word, Excel etc.
 */
export function CloudinaryFormationUpload({
  onUploaded,
  label = "Adicionar arquivo",
  accept = FORMATIONS_ACCEPT,
  multiple = true,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadOne = useCallback(async (file: File): Promise<string | null> => {
    const signRes = await fetch("/api/admin/site/uploads/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "formations" }),
    });
    const signJson = await signRes.json();
    if (!signRes.ok || !signJson.ok) return null;
    const { timestamp, signature, apiKey, cloudName, folder } = signJson.data;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", folder);

    const isImage = file.type.startsWith("image/");
    const endpoint = isImage
      ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      : `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

    const uploadRes = await fetch(endpoint, { method: "POST", body: formData });
    const uploadJson = (await uploadRes.json()) as { secure_url?: string; error?: { message?: string } };
    if (!uploadRes.ok || uploadJson.error) return null;
    return uploadJson.secure_url ?? null;
  }, []);

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
          const url = await uploadOne(file);
          if (url) onUploaded(url);
          else lastError = lastError ?? "Falha no upload de algum arquivo.";
        }
        if (lastError) setError(lastError);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [multiple, onUploaded, uploadOne]
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
            multiple={multiple}
          />
          {uploading ? "Enviando…" : multiple ? "Escolher arquivos" : "Escolher arquivo"}
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
