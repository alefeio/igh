"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import { apimagesUploadHeaders, buildApimagesUploadFormData, parseApimagesUploadJson, readApiJson } from "@/lib/apimages-upload";

const UPLOAD_SIGNATURE = "/api/me/uploads/signature";

type Identity = {
  photoUrl: string | null;
  signatureUrl: string | null;
  canEditPhoto: boolean;
  canEditSignature: boolean;
  birthDate: string;
};

export function MeusDadosIdentidade() {
  const toast = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "signature" | null>(null);
  const [data, setData] = useState<Identity | null>(null);
  const [birthDate, setBirthDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/identidade", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<Identity>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar o perfil.");
        return;
      }
      setData(json.data);
      setBirthDate(json.data.birthDate ?? "");
    } catch {
      toast.push("error", "Falha ao carregar o perfil.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File, kind: "photo" | "signature") {
    setUploading(kind);
    try {
      const signRes = await fetch(UPLOAD_SIGNATURE, { method: "POST" });
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
      const patchRes = await fetch("/api/me/identidade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "photo" ? { photoUrl: cloud.url } : { signatureUrl: cloud.url }),
      });
      const patchJson = (await patchRes.json()) as ApiResponse<unknown>;
      if (!patchRes.ok || !patchJson.ok) {
        toast.push("error", !patchJson.ok ? patchJson.error.message : "Falha ao salvar o arquivo.");
        return;
      }
      setData((prev) =>
        prev
          ? kind === "photo"
            ? { ...prev, photoUrl: cloud.url ?? null }
            : { ...prev, signatureUrl: cloud.url ?? null }
          : prev,
      );
      toast.push("success", kind === "photo" ? "Foto atualizada." : "Assinatura atualizada.");
    } catch {
      toast.push("error", "Falha ao enviar o arquivo.");
    } finally {
      setUploading(null);
    }
  }

  async function clearImage(kind: "photo" | "signature") {
    setUploading(kind);
    try {
      const res = await fetch("/api/me/identidade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "photo" ? { photoUrl: null } : { signatureUrl: null }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao remover.");
        return;
      }
      setData((prev) =>
        prev ? (kind === "photo" ? { ...prev, photoUrl: null } : { ...prev, signatureUrl: null }) : prev,
      );
      toast.push("success", kind === "photo" ? "Foto removida." : "Assinatura removida.");
    } catch {
      toast.push("error", "Falha ao remover.");
    } finally {
      setUploading(null);
    }
  }

  async function saveBirthDate() {
    setSavingDate(true);
    try {
      const res = await fetch("/api/me/identidade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar a data de nascimento.");
        return;
      }
      toast.push("success", "Data de nascimento atualizada.");
    } catch {
      toast.push("error", "Falha ao salvar a data de nascimento.");
    } finally {
      setSavingDate(false);
    }
  }

  if (loading || !data) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {data.canEditPhoto ? (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Foto de perfil</h3>
          <div className="flex flex-wrap items-center gap-4">
            {data.photoUrl ? (
              <img src={data.photoUrl} alt="Foto de perfil" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--igh-surface)] text-xs text-[var(--text-muted)]">
                Sem foto
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading != null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file, "photo");
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading != null}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploading === "photo" ? "Enviando…" : "Trocar foto"}
              </Button>
              {data.photoUrl ? (
                <Button type="button" variant="secondary" size="sm" disabled={uploading != null} onClick={() => void clearImage("photo")}>
                  Remover
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Data de nascimento</h3>
        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <p className="text-xs text-[var(--text-muted)]">Usada no cadastro e na notificação de aniversário.</p>
        <Button type="button" size="sm" disabled={savingDate} onClick={() => void saveBirthDate()}>
          {savingDate ? "Salvando…" : "Salvar data"}
        </Button>
      </div>

      {data.canEditSignature ? (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Assinatura</h3>
          <p className="text-xs text-[var(--text-muted)]">
            PNG ou JPG com fundo transparente, usada no certificado de conclusão.
          </p>
          {data.signatureUrl ? (
            <img
              src={data.signatureUrl}
              alt="Assinatura"
              className="max-h-20 max-w-full rounded-md border border-[var(--card-border)] bg-white object-contain p-2"
            />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma assinatura enviada.</p>
          )}
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading != null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file, "signature");
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading != null}
              onClick={() => signatureInputRef.current?.click()}
            >
              {uploading === "signature" ? "Enviando…" : "Trocar assinatura"}
            </Button>
            {data.signatureUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading != null}
                onClick={() => void clearImage("signature")}
              >
                Remover
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
