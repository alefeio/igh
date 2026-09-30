"use client";

import { UserCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmployeeSelfProfileForm } from "@/components/colaborador/EmployeeSelfProfileForm";
import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import {
  COLABORADOR_UPLOAD_SIGNATURE,
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";

type EmployeePhoto = {
  photoUrl: string | null;
};

export default function ColaboradorDadosPage() {
  const toast = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/colaborador", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ employee: EmployeePhoto }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar seus dados.");
        return;
      }
      setPhotoUrl(json.data.employee.photoUrl);
    } catch {
      toast.push("error", "Falha ao carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadPhoto(file: File) {
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
      const patchRes = await fetch("/api/me/colaborador", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: cloud.url }),
      });
      const patchJson = (await patchRes.json()) as ApiResponse<{ employee: EmployeePhoto }>;
      if (!patchRes.ok || !patchJson.ok) {
        toast.push("error", !patchJson.ok ? patchJson.error.message : "Falha ao salvar a foto.");
        return;
      }
      setPhotoUrl(patchJson.data.employee.photoUrl);
      toast.push("success", "Foto atualizada.");
    } catch {
      toast.push("error", "Falha ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Portal do colaborador"
        title="Meus dados"
        description="Atualize dados pessoais, MEI, conta bancária, Pix, endereço e a foto de perfil."
      />

      <SectionCard title="Foto" variant="elevated">
        <div className="flex flex-wrap items-center gap-4">
          {photoUrl ? (
            <img src={photoUrl} alt="Foto de perfil" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--igh-surface)] text-[var(--text-muted)]">
              <UserCircle className="h-10 w-10" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              disabled={uploading || loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadPhoto(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || loading}
              onClick={() => photoInputRef.current?.click()}
            >
              {uploading ? "Enviando…" : "Trocar foto"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cadastro" variant="elevated">
        <EmployeeSelfProfileForm />
      </SectionCard>
    </PanelPageStack>
  );
}
