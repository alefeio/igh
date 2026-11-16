"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import { formatDaysFullPt } from "@/lib/turma-display";
import {
  buildAdministrativeRecord,
  CONTACT_RESULTS,
  contextVariables,
  DATE_VARIABLES,
  MESSAGE_TEMPLATES,
  messageEvidenceWarning,
  renderMessage,
  RESULT_LABELS,
  templateVariables,
  todayBelem,
  VARIABLE_LABELS,
  whatsappMessageUrl,
  type ContactResult,
  type ContactType,
  type MessageAudience,
  type MessageContext,
  type MessageVariable,
} from "@/lib/busca-ativa";

export function BuscaAtivaComposer({
  context,
  audience,
  onSaved,
  refresh,
  initialTemplateId,
  onTemplateChange,
  allowedTemplateIds,
  onDirtyChange,
  compact = false,
}: {
  context: MessageContext;
  audience: MessageAudience;
  onSaved?: (advance?: boolean) => void;
  refresh: () => Promise<MessageContext | null>;
  initialTemplateId?: string;
  onTemplateChange?: (id: string) => void;
  allowedTemplateIds?: string[];
  onDirtyChange?: (dirty: boolean) => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const user = useUser();
  const candidates = useMemo(
    () =>
      MESSAGE_TEMPLATES.filter(
        (t) =>
          t.audience === audience &&
          (context.waitlistId ? t.id === "lista-espera" : t.id !== "lista-espera") &&
          (!allowedTemplateIds || allowedTemplateIds.includes(t.id)),
      ),
    [audience, allowedTemplateIds, context.waitlistId],
  );
  const [templateId, setTemplateId] = useState(
    candidates.some((t) => t.id === initialTemplateId)
      ? initialTemplateId!
      : (candidates.find((t) => t.id === "ausencia-acolhedora")?.id ?? candidates[0]?.id ?? ""),
  );
  const [extras, setExtras] = useState<Partial<Record<MessageVariable, string>>>({});
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [validating, setValidating] = useState(false);
  const [recordOpen, setRecordOpen] = useState(audience === "interno");
  const [copyFailed, setCopyFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [recordType, setRecordType] = useState<ContactType>(
    audience === "interno" ? "OBSERVACAO" : "CONTATO_REALIZADO",
  );
  const [factDate, setFactDate] = useState(todayBelem());
  const [channel, setChannel] = useState("WhatsApp");
  const [result, setResult] = useState<ContactResult>("AGUARDANDO_RESPOSTA");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [evidenceChecked, setEvidenceChecked] = useState(false);
  const previousRevision = useRef(context.revision);
  const template = candidates.find((t) => t.id === templateId) ?? candidates[0];
  const defaults = useMemo(() => contextVariables(context), [context]);
  const values = { ...defaults, ...extras };
  const rendered = template
    ? renderMessage(template, values)
    : { text: "", missing: [] as MessageVariable[], unknown: [] as string[] };
  const evidenceWarning = template ? messageEvidenceWarning(template, context) : null;
  const sensitiveConfirmation =
    template?.id === "retomada" ||
    template?.id === "desistencia" ||
    template?.id === "saiu-grupo" ||
    template?.id === "encerramento-curso" ||
    template?.id === "remarcacao";
  const canUse =
    Boolean(text.trim()) &&
    rendered.missing.length === 0 &&
    rendered.unknown.length === 0 &&
    !stale &&
    !busy &&
    !validating &&
    !/{{[^}]*}}|\bundefined\b|\bnull\b/i.test(text) &&
    (!(evidenceWarning || sensitiveConfirmation) || evidenceChecked);
  const validPhone = whatsappMessageUrl(context.studentPhone, text) !== null;
  const recordText =
    audience === "turma"
      ? ""
      : buildAdministrativeRecord({
          type: recordType,
          text,
          factDate:
            recordType === "CONTATO_REALIZADO" || recordType === "RETORNO_INFORMADO"
              ? factDate
              : undefined,
          channel:
            recordType === "CONTATO_REALIZADO" || recordType === "RETORNO_INFORMADO"
              ? channel
              : undefined,
          result:
            recordType === "CONTATO_REALIZADO" || recordType === "RETORNO_INFORMADO"
              ? result
              : undefined,
          note,
          authorName: user.name,
          templateId: template?.id,
          templateVersion: template?.version,
        });

  useEffect(() => {
    if (!edited && !stale && previousRevision.current === context.revision) setText(rendered.text);
  }, [rendered.text, edited, stale, context.revision]);
  useEffect(() => {
    if (previousRevision.current !== context.revision) {
      previousRevision.current = context.revision;
      setStale(true);
    }
  }, [context.revision]);

  function chooseTemplate(next: string) {
    if (edited && !window.confirm("O texto foi editado. Trocar o modelo e descartar as edições?"))
      return;
    setTemplateId(next);
    onTemplateChange?.(next);
    setExtras({});
    setEdited(false);
    setStale(false);
    setEvidenceChecked(false);
    setCopyFailed(false);
    setCopyStatus("");
    setRequestId(crypto.randomUUID());
    onDirtyChange?.(false);
  }
  async function validateLatest(): Promise<boolean> {
    setValidating(true);
    try {
      const latest = await refresh();
      if (!latest) return false;
      if (latest.revision !== context.revision) {
        setStale(true);
        toast.push("error", "Os dados mudaram. Atualize e revise a mensagem antes de usar.");
        return false;
      }
      return true;
    } finally {
      setValidating(false);
    }
  }
  async function copy() {
    if (!canUse) return;
    if (!(await validateLatest())) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopyStatus(audience === "interno" ? "Texto interno copiado." : "Mensagem copiada.");
      toast.push(
        "success",
        audience === "interno" ? "Texto interno copiado." : "Mensagem copiada.",
      );
    } catch {
      setCopyFailed(true);
      setCopyStatus("A cópia automática falhou. Selecione o texto e copie manualmente.");
      toast.push(
        "error",
        "A cópia automática falhou. Selecione o texto abaixo e copie manualmente.",
      );
    }
  }
  async function openWhatsapp() {
    if (!canUse || audience !== "aluno") return;
    const url = whatsappMessageUrl(context.studentPhone, text);
    if (!url) return;
    const tab = window.open("", "_blank");
    if (!tab) {
      toast.push(
        "error",
        "O navegador bloqueou a nova aba. Copie a mensagem e abra a conversa manualmente.",
      );
      return;
    }
    if (!(await validateLatest())) {
      tab.close();
      return;
    }
    tab.opener = null;
    tab.location.href = url;
  }
  async function save(advance = false) {
    if (!canUse || !context.enrollmentId || audience === "turma" || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    if ((recordType === "CONTATO_REALIZADO" || recordType === "RETORNO_INFORMADO") && !factDate) {
      toast.push("error", "Informe a data do contato.");
      busyRef.current = false;
      setBusy(false);
      return;
    }
    try {
      if (!(await validateLatest())) return;
      const response = await fetch(
        `/api/teacher/class-groups/${context.classGroupId}/enrollments/${context.enrollmentId}/history`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: text,
            contactType: recordType,
            factDate,
            channel,
            result,
            note,
            templateId: template?.id,
            templateVersion: template?.version,
            revision: context.revision,
            requestId,
          }),
        },
      );
      const json = (await response.json()) as ApiResponse<{ entry: unknown }>;
      if (!response.ok || !json.ok) {
        toast.push("error", json.ok ? "Não foi possível salvar." : json.error.message);
        if (response.status === 409) setStale(true);
        return;
      }
      setRequestId(crypto.randomUUID());
      onDirtyChange?.(false);
      toast.push("success", "Registro salvo.");
      setRecordOpen(false);
      onSaved?.(advance);
    } catch {
      toast.push("error", "Falha de rede ao salvar. Tente novamente.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm text-[var(--text-primary)]">
      {!compact ? (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-3">
          <strong>{audience === "turma" ? "Mensagem para a turma" : context.studentName}</strong>
          <p>
            {context.courseName} · {context.turmaNome}
          </p>
          <p>
            {formatDaysFullPt(context.daysOfWeek) || "Dias não informados"} ·{" "}
            {context.startTime && context.endTime
              ? `${context.startTime} às ${context.endTime}`
              : "Horário não informado"}
          </p>
        </div>
      ) : (
        <h3 className="text-base font-semibold">
          {audience === "turma" ? "Mensagem para a turma" : context.studentName}
        </h3>
      )}
      <div>
        <label className="flex flex-col gap-1">
          Modelo
          <select
            className="theme-input rounded-md border px-3 py-2"
            value={template?.id ?? ""}
            onChange={(e) => chooseTemplate(e.target.value)}
          >
            {candidates.length === 0 ? (
              <option value="" disabled>
                Nenhum modelo encontrado
              </option>
            ) : (
              candidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.category} · {t.title}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      {template?.description ? (
        <p className="text-xs text-[var(--text-muted)]">{template.description}</p>
      ) : null}
      {template ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {templateVariables(template)
            .filter((v) => !defaults[v])
            .map((v) => (
              <label key={v} className="flex flex-col gap-1">
                {VARIABLE_LABELS[v]}
                <input
                  className="theme-input rounded-md border px-3 py-2"
                  type={DATE_VARIABLES.has(v) ? "date" : "text"}
                  value={extras[v] ?? ""}
                  onChange={(e) => {
                    setExtras((old) => ({ ...old, [v]: e.target.value }));
                    if (edited) setStale(true);
                    onDirtyChange?.(true);
                  }}
                />
              </label>
            ))}
        </div>
      ) : null}
      {rendered.unknown.length ? (
        <p role="alert" className="text-rose-700">
          Modelo com variável desconhecida: {rendered.unknown.join(", ")}.
        </p>
      ) : null}
      {rendered.missing.length ? (
        <p role="alert" className="text-rose-700">
          Falta preencher: {rendered.missing.map((v) => VARIABLE_LABELS[v]).join(", ")}.
        </p>
      ) : null}
      {evidenceWarning || sensitiveConfirmation ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-500/50 p-3">
          <input
            type="checkbox"
            checked={evidenceChecked}
            onChange={(e) => setEvidenceChecked(e.target.checked)}
          />
          <span>
            {evidenceWarning || "Confirmo que este fato foi verificado antes de usar o texto."}
          </span>
        </label>
      ) : null}
      {stale ? (
        <div role="alert" className="rounded-md border border-amber-500 p-3">
          O contexto ou os campos mudaram. Revise antes de usar.{" "}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setText(rendered.text);
              setEdited(false);
              setStale(false);
              setEvidenceChecked(false);
              setRequestId(crypto.randomUUID());
              onDirtyChange?.(false);
            }}
          >
            Regenerar e revisar
          </Button>
        </div>
      ) : null}
      <label className="flex flex-col gap-1 font-medium">
        {audience === "interno" ? "Registro interno editável" : "Mensagem editável"}
        <textarea
          className="theme-input min-h-40 w-full rounded-md border px-3 py-2 font-normal"
          rows={8}
          maxLength={1700}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setEdited(true);
            setRequestId(crypto.randomUUID());
            onDirtyChange?.(true);
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!canUse} onClick={() => void copy()}>
          {audience === "interno" ? "Copiar texto interno" : "Copiar mensagem"}
        </Button>
        {audience === "aluno" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={!canUse || !validPhone}
            onClick={() => void openWhatsapp()}
          >
            Abrir WhatsApp
          </Button>
        ) : null}
        {audience !== "turma" && context.enrollmentId && !recordOpen ? (
          <Button type="button" variant="secondary" onClick={() => setRecordOpen(true)}>
            Registrar contato
          </Button>
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copyStatus}
      </span>
      {audience === "aluno" && !validPhone ? (
        <p className="text-xs text-[var(--text-muted)]">
          Telefone ausente ou inválido. A cópia continua disponível.
        </p>
      ) : null}
      {copyFailed ? (
        <p role="alert">Selecione o texto no editor acima e copie manualmente.</p>
      ) : null}
      {audience !== "turma" && context.enrollmentId && recordOpen ? (
        <div className="space-y-3 border-t border-[var(--card-border)] pt-4">
          <h3 className="font-semibold">Registrar contato ou informação</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Gerar, copiar ou abrir WhatsApp não registra contato. Salve apenas quando houver uma
            informação a registrar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              Natureza
              <select
                className="theme-input rounded-md border px-3 py-2"
                value={recordType}
                onChange={(e) => {
                  setRecordType(e.target.value as ContactType);
                  onDirtyChange?.(true);
                }}
              >
                <option value="OBSERVACAO">Rascunho / observação</option>
                <option value="CONTATO_REALIZADO">Contato realizado</option>
                <option value="RETORNO_INFORMADO">Retorno informado</option>
                <option value="ENCAMINHAMENTO">Encaminhamento</option>
              </select>
            </label>
            {recordType === "CONTATO_REALIZADO" || recordType === "RETORNO_INFORMADO" ? (
              <>
                <label className="flex flex-col gap-1">
                  Data do fato
                  <input
                    type="date"
                    className="theme-input rounded-md border px-3 py-2"
                    value={factDate}
                    onChange={(e) => {
                      setFactDate(e.target.value);
                      onDirtyChange?.(true);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Canal
                  <select
                    className="theme-input rounded-md border px-3 py-2"
                    value={channel}
                    onChange={(e) => {
                      setChannel(e.target.value);
                      onDirtyChange?.(true);
                    }}
                  >
                    <option>WhatsApp</option>
                    <option>Telefone</option>
                    <option>Presencial</option>
                    <option>Outro</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Resultado conhecido
                  <select
                    className="theme-input rounded-md border px-3 py-2"
                    value={result}
                    onChange={(e) => {
                      setResult(e.target.value as ContactResult);
                      onDirtyChange?.(true);
                    }}
                  >
                    {CONTACT_RESULTS.map((r) => (
                      <option key={r} value={r}>
                        {RESULT_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>
          <label className="flex flex-col gap-1">
            Observação opcional
            <input
              className="theme-input rounded-md border px-3 py-2"
              maxLength={300}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                onDirtyChange?.(true);
              }}
            />
          </label>
          <div className="rounded-md border border-[var(--card-border)] p-3">
            <p className="mb-2 font-semibold">Texto que será gravado</p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm">{recordText}</pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!canUse || recordText.length > 2000}
              onClick={() => void save()}
            >
              {busy ? "Salvando…" : "Salvar registro"}
            </Button>
            {compact ? (
              <Button
                type="button"
                variant="secondary"
                disabled={!canUse || recordText.length > 2000}
                onClick={() => void save(true)}
              >
                Salvar e próximo
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
