"use client";

import { useCallback, useState } from "react";
import {
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  COURSE_FORMATION_UPLOAD_SIGNATURE,
  parseApimagesUploadJson,
  readApiJson,
  SITE_UPLOAD_SIGNATURE,
  TEACHER_UPLOAD_SIGNATURE,
} from "@/lib/apimages-upload";

const FORMATIONS_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Props = {
  onUploaded: (url: string) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
  /** Tipo para RBAC no backend (formations = aulas; onboarding = guia). O upload vai para APIMG_UPLOAD_URL. */
  siteKind?: "formations" | "onboarding";
  /**
   * `course` = planos de aula (/courses/.../lesson) — usa API de cursos.
   * `site` = CMS / onboarding — usa API admin do site.
   */
  uploadContext?: "course" | "site";
  /** Papel da sessão (para professor usar rota dedicada em contexto de curso). */
  userRole?: "MASTER" | "ADMIN" | "COORDINATOR" | "POLO_COORDINATOR" | "TEACHER" | "STUDENT";
};

/**
 * Imagens e arquivos (PDF, Office) no endpoint Apimages (POST multipart só com `file`, header X-API-Key).
 */
export function ApimagesFormationUpload({
  onUploaded,
  label = "Adicionar arquivo",
  accept = FORMATIONS_ACCEPT,
  multiple = true,
  siteKind = "formations",
  uploadContext = "site",
  userRole,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveSignature = useCallback((): { url: string; body?: string } => {
    if (uploadContext === "course") {
      if (userRole === "TEACHER") {
        return { url: TEACHER_UPLOAD_SIGNATURE };
      }
      return { url: COURSE_FORMATION_UPLOAD_SIGNATURE };
    }
    return {
      url: SITE_UPLOAD_SIGNATURE,
      body: JSON.stringify({ kind: siteKind }),
    };
  }, [uploadContext, siteKind, userRole]);

  const uploadOne = useCallback(async (file: File): Promise<string | null> => {
    const { url, body } = resolveSignature();
    const signRes = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    const signJson = await readApiJson<{ uploadUrl: string; apiKey: string }>(signRes);
    if (!signRes.ok || !signJson.ok) {
      throw new Error(signJson.ok ? "Falha ao preparar upload." : signJson.error.message);
    }

    const formData = buildApimagesUploadFormData(file);
    const uploadRes = await fetch(signJson.data.uploadUrl, {
      method: "POST",
      headers: apimagesUploadHeaders(signJson.data.apiKey),
      body: formData,
    });
    const uploadJson = await uploadRes.json().catch(() => null);
    const parsed = parseApimagesUploadJson(uploadJson);
    if (!uploadRes.ok || parsed.errorMessage || !parsed.url) {
      throw new Error(parsed.errorMessage ?? "Falha no upload.");
    }
    return parsed.url;
  }, [resolveSignature]);

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
          try {
            const url = await uploadOne(file);
            if (url) onUploaded(url);
            else lastError = lastError ?? "Falha no upload de algum arquivo.";
          } catch (err) {
            lastError = err instanceof Error ? err.message : "Falha no upload.";
          }
        }
        if (lastError) setError(lastError);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [multiple, onUploaded, uploadOne],
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
