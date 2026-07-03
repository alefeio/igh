"use client";

import { ImagePlus, X } from "lucide-react";
import { useCallback, useState } from "react";

import {
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  parseApimagesUploadJson,
} from "@/lib/apimages-upload";
import { MAX_FORUM_QUESTION_IMAGES } from "@/lib/forum-question-content";

type ForumImageUploadProps = {
  imageUrls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  maxImages?: number;
  /** Rota POST para assinatura de upload (padrão: aluno). */
  uploadSignaturePath?: string;
};

export function ForumImageUpload({
  imageUrls,
  onChange,
  disabled = false,
  maxImages = MAX_FORUM_QUESTION_IMAGES,
  uploadSignaturePath = "/api/me/uploads/apimages-signature",
}: ForumImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadOne = useCallback(async (file: File): Promise<string | null> => {
    const signRes = await fetch(uploadSignaturePath, {
      method: "POST",
      credentials: "include",
    });
    const signJson = await signRes.json();
    if (!signRes.ok || !signJson?.ok) return null;
    const { uploadUrl, apiKey } = signJson.data as { uploadUrl: string; apiKey: string };

    const formData = buildApimagesUploadFormData(file);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: apimagesUploadHeaders(apiKey),
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    const parsed = parseApimagesUploadJson(uploadJson);
    if (!uploadRes.ok || parsed.errorMessage || !parsed.url) return null;
    return parsed.url;
  }, [uploadSignaturePath]);

  const handleFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      const remaining = maxImages - imageUrls.length;
      if (remaining <= 0) {
        setError(`Máximo de ${maxImages} fotos por publicação.`);
        e.target.value = "";
        return;
      }
      const fileList = Array.from(files).slice(0, remaining);
      setError(null);
      setUploading(true);
      const newUrls = [...imageUrls];
      try {
        for (const file of fileList) {
          if (!file.type.startsWith("image/")) {
            setError("Apenas imagens são permitidas.");
            continue;
          }
          const url = await uploadOne(file);
          if (url && !newUrls.includes(url)) newUrls.push(url);
          else if (!url) setError("Falha ao enviar alguma foto. Tente novamente.");
        }
        onChange(newUrls);
      } catch {
        setError("Erro ao enviar fotos.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [imageUrls, maxImages, onChange, uploadOne]
  );

  const removeAt = (index: number) => {
    onChange(imageUrls.filter((_, i) => i !== index));
  };

  const canAddMore = imageUrls.length < maxImages;

  return (
    <div className="flex flex-col gap-2">
      {imageUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageUrls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]"
            >
              <img src={url} alt={`Anexo ${index + 1}`} className="h-full w-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                  aria-label={`Remover foto ${index + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canAddMore && (
        <label
          className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/50 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--igh-surface)] ${disabled || uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled || uploading}
            onChange={handleFiles}
          />
          <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
          {uploading ? "Enviando fotos…" : "Adicionar fotos"}
        </label>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        Até {maxImages} fotos por publicação. {imageUrls.length > 0 ? `${imageUrls.length}/${maxImages} anexadas.` : ""}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
