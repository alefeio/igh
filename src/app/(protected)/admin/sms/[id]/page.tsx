"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Recipient = {
  id: string;
  recipientNameSnapshot: string;
  phoneSnapshot: string;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  audienceType: string;
  status: string;
  messageContent: string | null;
  totalFound: number;
  totalValid: number;
  totalMissingPhone: number;
  totalInvalidPhone: number;
  totalDuplicatesRemoved: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  createdBy: { name: string; email: string };
  confirmedBy: { name: string; email: string } | null;
  canceledBy: { name: string; email: string } | null;
  recipients: Recipient[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  PROCESSING: "Enviando",
  SENT: "Enviada",
  PARTIALLY_SENT: "Parcial",
  FAILED: "Falha",
  CANCELED: "Cancelada",
};

const RECIPIENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  QUEUED: "Na fila",
  SENT: "Enviado",
  DELIVERED: "Entregue",
  FAILED: "Falha",
  INVALID_PHONE: "Telefone inválido",
  CANCELED: "Cancelado",
};

export default function SmsCampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<{
    totalFound: number;
    totalWithPhone: number;
    totalValid: number;
    totalMissingPhone: number;
    totalInvalidPhone: number;
    totalDuplicatesRemoved: number;
    totalEligible: number;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [sendImmediately, setSendImmediately] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sms/campaigns/${id}`);
      const json = (await res.json()) as ApiResponse<{ campaign: Campaign }>;
      if (!res.ok || !json.ok) {
        const message = !json.ok ? json.error?.message ?? "Campanha não encontrada." : "Erro ao carregar.";
        setLoadError(message);
        toast.push("error", message);
        return;
      }
      setCampaign(json.data.campaign);
    } catch {
      const message = "Não foi possível carregar a campanha.";
      setLoadError(message);
      toast.push("error", message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleProcessBatch() {
    if (!id || processing) return;
    setProcessError(null);
    setProcessing(true);
    try {
      const res = await fetch(`/api/sms/campaigns/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 20 }),
      });
      const json = (await res.json()) as ApiResponse<{ processed: number; remaining: number; done: boolean }>;
      if (!res.ok || !json.ok) {
        const msg = !json.ok ? json.error?.message ?? "Falha ao processar." : "Falha ao processar.";
        setProcessError(msg);
        toast.push("error", msg);
        return;
      }
      toast.push("success", `Processados ${json.data.processed}. Restantes: ${json.data.remaining}.`);
      await load();
    } finally {
      setProcessing(false);
    }
  }

  async function loadPreview() {
    if (!id) return;
    const res = await fetch(`/api/sms/campaigns/${id}/preview`, { method: "POST" });
    const json = (await res.json()) as ApiResponse<{ preview: typeof preview }>;
    if (res.ok && json.ok) setPreview(json.data.preview);
    else toast.push("error", !json.ok ? json.error?.message ?? "Falha na prévia." : "Falha na prévia.");
  }

  function openConfirm() {
    setConfirmMessage(campaign?.messageContent ?? "");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!id || !confirmMessage.trim()) {
      toast.push("error", "Mensagem é obrigatória.");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch(`/api/sms/campaigns/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: confirmMessage.trim(), sendImmediately: sendImmediately }),
      });
      const json = (await res.json()) as ApiResponse<{ campaign: Campaign }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao confirmar." : "Falha ao confirmar.");
        return;
      }
      toast.push("success", sendImmediately ? "Campanha confirmada. Processe os lotes ou aguarde o cron." : "Campanha confirmada e agendada.");
      setConfirmOpen(false);
      await load();
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    if (!id || !confirm("Cancelar esta campanha?")) return;
    const res = await fetch(`/api/sms/campaigns/${id}/cancel`, { method: "POST" });
    const json = (await res.json()) as ApiResponse<{ campaign: Campaign }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Falha ao cancelar." : "Falha ao cancelar.");
      return;
    }
    toast.push("success", "Campanha cancelada.");
    await load();
  }

  if (loading && !campaign) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-[var(--text-muted)]">Carregando...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4">
          <Link href="/admin/sms" className="text-[var(--igh-primary)] hover:underline">← Campanhas</Link>
        </div>
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center">
          <p className="text-[var(--text-muted)]">{loadError ?? "Não foi possível carregar a campanha."}</p>
          <Button className="mt-3" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const canCancel = campaign.status === "SCHEDULED" || campaign.status === "DRAFT";
  const canProcess = campaign.status === "PROCESSING" || campaign.status === "SCHEDULED";
  const hasPending = campaign.recipients.some((r) => r.status === "PENDING");
  const isDraft = campaign.status === "DRAFT";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/sms" className="text-[var(--igh-primary)] hover:underline">← Campanhas</Link>
      </div>

      <div className="mb-6 rounded border border-[var(--border)] bg-[var(--bg)] p-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{campaign.name}</h1>
        {campaign.description && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{campaign.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={campaign.status === "SENT" ? "green" : campaign.status === "FAILED" || campaign.status === "CANCELED" ? "red" : "zinc"}>
            {STATUS_LABEL[campaign.status] ?? campaign.status}
          </Badge>
          <span className="text-sm text-[var(--text-muted)]">Público: {campaign.audienceType}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>Encontrados: <strong>{campaign.totalFound}</strong></div>
          <div>Elegíveis: <strong>{campaign.totalValid}</strong></div>
          <div>Enviados: <strong>{campaign.totalSent}</strong></div>
          <div>Falhas: <strong>{campaign.totalFailed}</strong></div>
        </div>
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          Criada em {new Date(campaign.createdAt).toLocaleString("pt-BR")} por {campaign.createdBy.name}
          {campaign.confirmedBy && ` · Confirmada por ${campaign.confirmedBy.name}`}
          {campaign.canceledBy && ` · Cancelada por ${campaign.canceledBy.name}`}
        </div>
        {isDraft && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={loadPreview}>Ver prévia</Button>
            <Button onClick={openConfirm}>Confirmar e agendar/enviar</Button>
          </div>
        )}
        {preview && (
          <div className="mt-3 rounded border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-sm">
            <strong>Prévia:</strong> {preview.totalFound} encontrados · {preview.totalWithPhone} com telefone · {preview.totalValid} válidos · {preview.totalEligible} elegíveis (após deduplicação). Sem telefone: {preview.totalMissingPhone}. Inválidos: {preview.totalInvalidPhone}. Duplicados removidos: {preview.totalDuplicatesRemoved}.
          </div>
        )}
        {processError && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            <p>{processError}</p>
            <Button className="mt-2" onClick={handleProcessBatch} disabled={processing}>
              {processing ? "Processando..." : "Tentar novamente"}
            </Button>
          </div>
        )}
        {canProcess && hasPending && !processError && (
          <div className="mt-4">
            <Button onClick={handleProcessBatch} disabled={processing}>
              {processing ? "Processando..." : "Processar lote"}
            </Button>
          </div>
        )}
        {canCancel && (
          <div className="mt-2">
            <Button variant="secondary" onClick={handleCancel}>Cancelar campanha</Button>
          </div>
        )}
      </div>

      {campaign.messageContent && (
        <div className="mb-6 rounded border border-[var(--border)] p-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Mensagem</h2>
          <p className="whitespace-pre-wrap text-sm text-[var(--text-muted)]">{campaign.messageContent}</p>
        </div>
      )}

      <div className="rounded border border-[var(--border)]">
        <h2 className="border-b border-[var(--border)] px-4 py-2 text-sm font-semibold">Destinatários ({campaign.recipients.length})</h2>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-2 text-left font-medium">Nome</th>
                <th className="px-4 py-2 text-left font-medium">Telefone</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Erro</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-2">{r.recipientNameSnapshot}</td>
                  <td className="px-4 py-2">{r.phoneSnapshot}</td>
                  <td className="px-4 py-2">
                    <Badge tone={r.status === "SENT" || r.status === "DELIVERED" ? "green" : r.status === "FAILED" || r.status === "INVALID_PHONE" ? "red" : "zinc"}>
                      {RECIPIENT_STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">{r.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-lg">
            <h3 className="mb-3 text-lg font-semibold">Confirmar envio</h3>
            <p className="mb-2 text-sm text-[var(--text-muted)]">Mensagem final (pode editar):</p>
            <textarea
              value={confirmMessage}
              onChange={(e) => setConfirmMessage(e.target.value)}
              rows={4}
              maxLength={1600}
              className="mb-3 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
            <label className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={sendImmediately}
                onChange={(e) => setSendImmediately(e.target.checked)}
              />
              <span className="text-sm">Iniciar envio imediatamente (processar lotes em seguida)</span>
            </label>
            <div className="flex gap-2">
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? "Confirmando..." : "Confirmar"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
