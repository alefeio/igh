"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiErr, ApiResponse } from "@/lib/api-types";
import { marketingCampaignVisibilityLabel } from "@/lib/marketing-campaign-active";

export type MarketingCampaignManageData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function MarketingCampaignManagePanel({
  campaign: initial,
  canManage,
}: {
  campaign: MarketingCampaignManageData;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [campaign, setCampaign] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [startsAt, setStartsAt] = useState(toDateInput(initial.startsAt));
  const [endsAt, setEndsAt] = useState(toDateInput(initial.endsAt));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const status = marketingCampaignVisibilityLabel({
    isActive: campaign.isActive,
    startsAt: campaign.startsAt ? new Date(campaign.startsAt) : null,
    endsAt: campaign.endsAt ? new Date(campaign.endsAt) : null,
  });

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/marketing-campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResponse<{ id: string }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function toggleActive() {
    if (!canManage || toggling) return;
    setToggling(true);
    try {
      const next = !campaign.isActive;
      const ok = await patch({ isActive: next });
      if (ok) {
        setCampaign((c) => ({ ...c, isActive: next }));
        toast.push(
          "success",
          next
            ? "Campanha ativada. Pode aparecer na página inicial e no dashboard dos alunos (se estiver no período)."
            : "Campanha desativada. Sumiu da página inicial e do dashboard dos alunos."
        );
      }
    } finally {
      setToggling(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || saving) return;
    if (!title.trim()) {
      toast.push("error", "Título é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const ok = await patch({
        title: title.trim(),
        description: description.trim() || null,
        startsAt: startsAt ? `${startsAt}T00:00:00.000Z` : null,
        endsAt: endsAt ? `${endsAt}T23:59:59.999Z` : null,
      });
      if (ok) {
        setCampaign((c) => ({
          ...c,
          title: title.trim(),
          description: description.trim() || null,
          startsAt: startsAt ? `${startsAt}T00:00:00.000Z` : null,
          endsAt: endsAt ? `${endsAt}T23:59:59.999Z` : null,
        }));
        toast.push("success", "Configurações salvas.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Gestão da campanha</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Slug: <span className="font-mono text-[var(--text-primary)]">{campaign.slug}</span>
          </p>
          <div className="mt-2">
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
            Com a campanha <strong>desativada</strong>, a seção some da página inicial do site e o botão/modal some do
            dashboard do aluno. As respostas já enviadas permanecem nesta área administrativa.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            variant={campaign.isActive ? "secondary" : "primary"}
            className={campaign.isActive ? "text-red-600" : undefined}
            disabled={toggling}
            onClick={() => void toggleActive()}
          >
            {toggling ? "…" : campaign.isActive ? "Desativar campanha" : "Ativar campanha"}
          </Button>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Somente Admin/Master pode alterar o status.</p>
        )}
      </div>

      {canManage ? (
        <form className="grid gap-3 border-t border-[var(--card-border)] pt-4 sm:grid-cols-2" onSubmit={saveSettings}>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Título</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Descrição (área do aluno)</label>
            <textarea
              className="theme-input mt-1 w-full resize-y rounded-lg border px-3 py-2 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Início (opcional)</label>
            <Input type="date" className="mt-1" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Término (opcional)</label>
            <Input type="date" className="mt-1" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar configurações"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}