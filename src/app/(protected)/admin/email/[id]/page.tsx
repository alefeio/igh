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
  emailSnapshot: string;
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
  subject: string | null;
  htmlContent: string | null;
  textContent: string | null;
  totalFound: number;
  totalValid: number;
  totalMissingEmail: number;
  totalInvalidEmail: number;
  totalDuplicatesRemoved: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  dispatchCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  createdBy: { name: string; email: string };
  confirmedBy: { name: string; email: string } | null;
  canceledBy: { name: string; email: string } | null;
  recipients: Recipient[];
};

const AUDIENCE_LABEL: Record<string, string> = {
  ALL_STUDENTS: "Todos os alunos",
  ENROLLED_STUDENTS: "Alunos matriculados",
  CLASS_GROUP: "Turma específica",
  STUDENTS_INCOMPLETE: "Alunos com cadastro incompleto",
  STUDENTS_COMPLETE: "Alunos com cadastro completo",
  STUDENTS_ACTIVE: "Alunos ativos",
  STUDENTS_INACTIVE: "Alunos inativos",
  BY_COURSE: "Alunos por curso",
  SPECIFIC_STUDENTS: "Alunos específicos",
  TEACHERS: "Professores",
  ADMINS: "Admins",
  ALL_ACTIVE_USERS: "Todos os usuários ativos",
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
  INVALID_EMAIL: "E-mail inválido",
  BOUNCED: "Bounce",
  COMPLAINED: "Reclamação",
  OPENED: "Aberto",
  CLICKED: "Clique",
  CANCELED: "Cancelado",
};

export default function EmailCampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resendingRecipientId, setResendingRecipientId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    totalFound: number;
    totalWithEmail: number;
    totalValid: number;
    totalMissingEmail: number;
    totalInvalidEmail: number;
    totalDuplicatesRemoved: number;
    totalEligible: number;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSubject, setConfirmSubject] = useState("");
  const [confirmHtml, setConfirmHtml] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [sendImmediately, setSendImmediately] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/email/campaigns/${id}`);
      const json = (await res.json()) as ApiResponse<{ campaign: Campaign }>;
      if (!res.ok || !json.ok) {
        const message = !json.ok
          ? json.error?.message ?? "Campanha não encontrada."
          : "Erro ao carregar.";
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
      const res = await fetch(`/api/email/campaigns/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await res.json()) as ApiResponse<{
        processed: number;
        remaining: number;
        done: boolean;
      }>;
      if (!res.ok || !json.ok) {
        const msg = !json.ok
          ? json.error?.message ?? "Falha ao processar."
          : "Falha ao processar.";
        setProcessError(msg);
        toast.push("error", msg);
        return;
      }
      toast.push(
        "success",
        `Processados ${json.data.processed}. Restantes: ${json.data.remaining}.`
      );
      await load();
    } finally {
      setProcessing(false);
    }
  }

  async function handleResendRecipient(recipientId: string) {
    if (!id || !recipientId) return;
    if (resendingRecipientId) return;
    if (!confirm("Reenviar este e-mail para este destinatário?")) return;
    setResendingRecipientId(recipientId);
    try {
      const res = await fetch(
        `/api/email/campaigns/${id}/recipients/${recipientId}/resend`,
        { method: "POST" }
      );
      const json = (await res.json()) as ApiResponse<{
        processed: number;
        remaining: number;
        done: boolean;
      }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? json.error?.message ?? "Falha ao reenviar." : "Falha ao reenviar."
        );
        return;
      }
      toast.push(
        "success",
        `Reenvio iniciado. Processados ${json.data.processed}. Restantes: ${json.data.remaining}.`
      );
      await load();
    } finally {
      setResendingRecipientId(null);
    }
  }

  async function loadPreview() {
    if (!id) return;
    const res = await fetch(`/api/email/campaigns/${id}/preview`, {
      method: "POST",
    });
    const json = (await res.json()) as ApiResponse<{ preview: typeof preview }>;
    if (res.ok && json.ok) setPreview(json.data.preview);
    else
      toast.push(
        "error",
        !json.ok ? json.error?.message ?? "Falha na prévia." : "Falha na prévia."
      );
  }

  function openConfirm() {
    setConfirmSubject(campaign?.subject ?? "");
    setConfirmHtml(campaign?.htmlContent ?? "");
    setConfirmText(campaign?.textContent ?? "");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!id || !confirmSubject.trim()) {
      toast.push("error", "Assunto é obrigatório.");
      return;
    }
    const hasHtml = confirmHtml.trim() !== "";
    const hasText = confirmText.trim() !== "";
    if (!hasHtml && !hasText) {
      toast.push("error", "Informe o conteúdo em HTML e/ou texto.");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch(`/api/email/campaigns/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: confirmSubject.trim(),
          htmlContent: hasHtml ? confirmHtml.trim() : null,
          textContent: hasText ? confirmText.trim() : null,
          sendImmediately,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ campaign: Campaign }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? json.error?.message ?? "Falha ao confirmar." : "Falha ao confirmar."
        );
        return;
      }
      toast.push(
        "success",
        sendImmediately
          ? "Campanha confirmada. Processe os lotes ou aguarde o cron."
          : "Campanha confirmada e agendada."
      );
      setConfirmOpen(false);
      await load();
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    if (!id || !confirm("Cancelar esta campanha?")) return;
    const res = await fetch(`/api/email/campaigns/${id}/cancel`, {
      method: "POST",
    });
    const json = (await res.json()) as ApiResponse<{ campaign: Campaign }>;
    if (!res.ok || !json.ok) {
      toast.push(
        "error",
        !json.ok ? json.error?.message ?? "Falha ao cancelar." : "Falha ao cancelar."
      );
      return;
    }
    toast.push("success", "Campanha cancelada.");
    await load();
  }

  async function handleDuplicate() {
    if (!id) return;
    const res = await fetch(`/api/email/campaigns/${id}/duplicate`, {
      method: "POST",
    });
    const json = (await res.json()) as ApiResponse<{ campaign: { id: string } }>;
    if (!res.ok || !json.ok) {
      toast.push(
        "error",
        !json.ok ? json.error?.message ?? "Falha ao duplicar." : "Falha ao duplicar."
      );
      return;
    }
    toast.push("success", "Campanha duplicada.");
    window.location.href = `/admin/email/${json.data.campaign.id}`;
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
          <Link
            href="/admin/email"
            className="text-[var(--igh-primary)] hover:underline"
          >
            ← Campanhas
          </Link>
        </div>
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center">
          <p className="text-[var(--text-muted)]">
            {loadError ?? "Não foi possível carregar a campanha."}
          </p>
          <Button className="mt-3" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const canCancel =
    campaign.status === "SCHEDULED" || campaign.status === "DRAFT";
  const canProcess =
    campaign.status === "PROCESSING" || campaign.status === "SCHEDULED";
  const hasPending = campaign.recipients.some((r) => r.status === "PENDING");
  const isDraft = campaign.status === "DRAFT";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/admin/email"
          className="text-[var(--igh-primary)] hover:underline"
        >
          ← Campanhas
        </Link>
        <Button variant="secondary" size="sm" onClick={handleDuplicate}>
          Duplicar
        </Button>
      </div>

      <div className="mb-6 rounded border border-[var(--border)] bg-[var(--bg)] p-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {campaign.name}
        </h1>
        {campaign.description && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {campaign.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge
            tone={
              campaign.status === "SENT"
                ? "green"
                : campaign.status === "FAILED" ||
                    campaign.status === "CANCELED"
                  ? "red"
                  : "zinc"
            }
          >
            {STATUS_LABEL[campaign.status] ?? campaign.status}
          </Badge>
          <span className="text-sm text-[var(--text-muted)]">
            Público: {AUDIENCE_LABEL[campaign.audienceType] ?? campaign.audienceType}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            Disparos:{" "}
            <strong title="Rodadas de envio em massa (1ª vez, nova rodada após reenfileirar falhas, etc.)">
              {campaign.dispatchCount ?? 0}
            </strong>
          </div>
          <div>
            Encontrados: <strong>{campaign.totalFound}</strong>
          </div>
          <div>
            Elegíveis: <strong>{campaign.totalValid}</strong>
          </div>
          <div>
            Enviados: <strong>{campaign.totalSent}</strong>
          </div>
          <div>
            Entregues: <strong>{campaign.totalDelivered}</strong>
          </div>
          <div>
            Falhas: <strong>{campaign.totalFailed}</strong>
          </div>
          {(campaign.totalOpened > 0 || campaign.totalClicked > 0) && (
            <>
              <div>
                Abertos: <strong>{campaign.totalOpened}</strong>
              </div>
              <div>
                Cliques: <strong>{campaign.totalClicked}</strong>
              </div>
            </>
          )}
        </div>
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          Criada em {new Date(campaign.createdAt).toLocaleString("pt-BR")} por{" "}
          {campaign.createdBy.name}
          {campaign.confirmedBy &&
            ` · Confirmada por ${campaign.confirmedBy.name}`}
          {campaign.canceledBy &&
            ` · Cancelada por ${campaign.canceledBy.name}`}
        </div>
        {isDraft && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={loadPreview}>
              Ver prévia
            </Button>
            <Button onClick={openConfirm}>
              Confirmar e agendar/enviar
            </Button>
          </div>
        )}
        {preview && (
          <div className="mt-3 rounded border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-sm">
            <strong>Prévia:</strong> {preview.totalFound} encontrados ·{" "}
            {preview.totalWithEmail} com e-mail · {preview.totalValid} válidos ·{" "}
            {preview.totalEligible} elegíveis (após deduplicação). Sem e-mail:{" "}
            {preview.totalMissingEmail}. Inválidos: {preview.totalInvalidEmail}.
            Duplicados removidos: {preview.totalDuplicatesRemoved}.
          </div>
        )}
        {processError && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            <p>{processError}</p>
            <Button
              className="mt-2"
              onClick={handleProcessBatch}
              disabled={processing}
            >
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
            <Button variant="secondary" onClick={handleCancel}>
              Cancelar campanha
            </Button>
          </div>
        )}
      </div>

      {(campaign.subject || campaign.htmlContent || campaign.textContent) && (
        <div className="mb-6 rounded border border-[var(--border)] p-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
            E-mail
          </h2>
          {campaign.subject && (
            <p className="mb-2 text-sm">
              <strong>Assunto:</strong> {campaign.subject}
            </p>
          )}
          {campaign.htmlContent && (
            <div className="mb-2 max-h-48 overflow-auto rounded border border-[var(--border)] bg-[var(--bg-muted)] p-2 text-sm">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: campaign.htmlContent }}
              />
            </div>
          )}
          {campaign.textContent && !campaign.htmlContent && (
            <p className="whitespace-pre-wrap text-sm text-[var(--text-muted)]">
              {campaign.textContent}
            </p>
          )}
        </div>
      )}

      <div className="rounded border border-[var(--border)]">
        <h2 className="border-b border-[var(--border)] px-4 py-2 text-sm font-semibold">
          Destinatários ({campaign.recipients.length})
        </h2>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-2 text-left font-medium">Nome</th>
                <th className="px-4 py-2 text-left font-medium">E-mail</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Erro</th>
                <th className="px-4 py-2 text-left font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-2">{r.recipientNameSnapshot}</td>
                  <td className="px-4 py-2">{r.emailSnapshot}</td>
                  <td className="px-4 py-2">
                    <Badge
                      tone={
                        r.status === "SENT" || r.status === "DELIVERED"
                          ? "green"
                          : r.status === "FAILED" ||
                              r.status === "INVALID_EMAIL" ||
                              r.status === "BOUNCED" ||
                              r.status === "COMPLAINED"
                            ? "red"
                            : "zinc"
                      }
                    >
                      {RECIPIENT_STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">
                    {r.errorMessage ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleResendRecipient(r.id)}
                      disabled={
                        resendingRecipientId !== null ||
                        campaign.status === "DRAFT" ||
                        campaign.status === "CANCELED" ||
                        r.status === "INVALID_EMAIL"
                      }
                      title={
                        campaign.status === "DRAFT"
                          ? "Confirme a campanha antes de reenviar."
                          : campaign.status === "CANCELED"
                            ? "Campanha cancelada."
                            : r.status === "INVALID_EMAIL"
                              ? "E-mail inválido."
                              : undefined
                      }
                    >
                      {resendingRecipientId === r.id ? "Reenviando..." : "Reenviar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-lg">
            <h3 className="mb-3 text-lg font-semibold">Confirmar envio</h3>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium">
                Assunto *
              </label>
              <input
                type="text"
                value={confirmSubject}
                onChange={(e) => setConfirmSubject(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium">
                Conteúdo HTML (opcional)
              </label>
              <textarea
                value={confirmHtml}
                onChange={(e) => setConfirmHtml(e.target.value)}
                rows={4}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] font-mono text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">
                Conteúdo texto (opcional)
              </label>
              <textarea
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                rows={3}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Pelo menos HTML ou texto é obrigatório.
              </p>
            </div>
            <label className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={sendImmediately}
                onChange={(e) => setSendImmediately(e.target.checked)}
              />
              <span className="text-sm">
                Iniciar envio imediatamente (processar lotes em seguida)
              </span>
            </label>
            <div className="flex gap-2">
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? "Confirmando..." : "Confirmar"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
