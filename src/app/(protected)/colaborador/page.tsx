"use client";

import { FileText, MessageSquare, UserCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  DashboardHero,
  PanelPageStack,
  QuickActionGrid,
  SectionCard,
  StatTile,
} from "@/components/dashboard/DashboardUI";
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

type PortalMe = {
  employee: {
    id: string;
    name: string;
    status: string;
    photoUrl: string | null;
    position: string;
    positionLabel: string;
  };
  pendingInvoices: number;
  unreadMessages: number;
};

export default function ColaboradorPortalPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<PortalMe | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/colaborador", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<PortalMe>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Você não tem acesso ao portal do colaborador.");
        return;
      }
      setData(json.data);
    } catch {
      toast.push("error", "Falha ao carregar o portal.");
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
      const patchJson = (await patchRes.json()) as ApiResponse<{ employee: PortalMe["employee"] }>;
      if (!patchRes.ok || !patchJson.ok) {
        toast.push("error", !patchJson.ok ? patchJson.error.message : "Falha ao salvar a foto.");
        return;
      }
      setData((prev) => (prev ? { ...prev, employee: patchJson.data.employee } : prev));
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
        title={loading ? "Meu portal" : `Olá, ${data?.employee.name.split(" ")[0] ?? ""}`}
        description="Envie sua nota fiscal, atualize a foto e fale com a gerência."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Notas em análise"
          value={loading ? "—" : data?.pendingInvoices ?? 0}
          icon={FileText}
          href="/colaborador/notas"
        />
        <StatTile
          label="Mensagens não lidas"
          value={loading ? "—" : data?.unreadMessages ?? 0}
          icon={MessageSquare}
          accent="amber"
          href="/colaborador/mensagens"
        />
        <StatTile
          label="Cargo"
          value={loading ? "—" : data?.employee.positionLabel ?? "—"}
          icon={UserCircle}
        />
      </div>

      <SectionCard title="Foto de perfil" variant="elevated">
        <div className="flex flex-wrap items-center gap-4">
          {data?.employee.photoUrl ? (
            <img
              src={data.employee.photoUrl}
              alt="Foto de perfil"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--igh-surface)] text-[var(--text-muted)]">
              <UserCircle className="h-10 w-10" />
            </div>
          )}
          <div>
            <p className="text-sm text-[var(--text-muted)]">JPG, PNG ou WEBP. A gerência também verá esta foto.</p>
            <label className="mt-2 inline-block">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading || loading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadPhoto(file);
                }}
              />
              <Button type="button" variant="secondary" disabled={uploading || loading}>
                {uploading ? "Enviando…" : "Trocar foto"}
              </Button>
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Atalhos" variant="elevated">
        <QuickActionGrid
          items={[
            {
              href: "/colaborador/notas",
              label: "Enviar nota",
              description: "Anexe a NF do mês; a leitura preenche valor e dados",
              icon: FileText,
              accent: "from-emerald-600 to-teal-500",
            },
            {
              href: "/colaborador/mensagens",
              label: "Falar com a gerência",
              description: "Canal interno, separado da coordenação pedagógica",
              icon: MessageSquare,
              accent: "from-sky-600 to-blue-500",
            },
          ]}
        />
      </SectionCard>
    </PanelPageStack>
  );
}
