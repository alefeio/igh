"use client";

import { useCallback, useState } from "react";

export type SiteUploadKind =
  | "logo"
  | "favicon"
  | "banners"
  | "partners"
  | "formations"
  | "projects"
  | "testimonials"
  | "news"
  | "transparency";

type Props = {
  kind: SiteUploadKind;
  id?: string;
  onUploaded: (url: string) => void;
  currentUrl?: string;
  label?: string;
  accept?: string;
};

export function CloudinaryImageUpload({
  kind,
  id,
  onUploaded,
  currentUrl,
  label = "Upload de imagem",
  accept = "image/*",
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
        const { timestamp, signature, apiKey, cloudName, folder } = signJson.data;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", apiKey);
        formData.append("timestamp", String(timestamp));
        formData.append("signature", signature);
        formData.append("folder", folder);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });
        const uploadJson = (await uploadRes.json()) as { secure_url?: string; error?: { message?: string } };
        if (!uploadRes.ok || uploadJson.error) {
          setError(uploadJson.error?.message ?? "Falha no upload.");
          return;
        }
        if (uploadJson.secure_url) {
          onUploaded(uploadJson.secure_url);
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
        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
          />
          {uploading ? "Enviando…" : "Escolher arquivo"}
        </label>
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Ver imagem atual
          </a>
        )}
      </div>
      {currentUrl && (
        <div className="mt-1">
          <img src={currentUrl} alt="Preview" className="max-h-24 rounded border border-zinc-200 object-cover" />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
