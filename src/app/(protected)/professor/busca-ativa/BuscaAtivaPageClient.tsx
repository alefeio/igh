"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuscaAtivaComposer } from "@/components/professor/BuscaAtivaComposer";
import {
  EnrollmentFollowUp,
  type EnrollmentHistoryItem,
} from "@/components/professor/EnrollmentFollowUp";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";
import {
  filterBuscaAtivaStudents,
  formatCalendarDate,
  RESULT_LABELS,
  type MessageAudience,
  type MessageContext,
} from "@/lib/busca-ativa";

type GroupPayload = { group: MessageContext; enrollments: MessageContext[] };
type WaitlistEntry = {
  id: string;
  createdAt: string;
  studentName: string;
  studentPhone: string | null;
};
type Mode = "aluno" | "interno" | "turma" | "espera";

function enrollmentStatusLabel(item: MessageContext): string {
  if (item.status === "CANCELLED") return "Matrícula cancelada";
  if (item.status === "SUSPENDED") return "Matrícula suspensa";
  if (item.studentUnavailable) return "Cadastro indisponível";
  if (item.isPreEnrollment) return "Pré-matrícula";
  switch (item.status) {
    case "ACTIVE":
      return "Matrícula ativa";
    default:
      return "Situação da matrícula indisponível";
  }
}

export function BuscaAtivaPageClient({
  classGroupId,
  initialMode = "aluno",
  initialEnrollmentId,
  onDraftDirtyChange,
}: {
  classGroupId: string;
  initialMode?: "aluno" | "turma";
  initialEnrollmentId?: string | null;
  onDraftDirtyChange?: (dirty: boolean) => void;
}) {
  const [groupData, setGroupData] = useState<GroupPayload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [search, setSearch] = useState("");
  const [frequency, setFrequency] = useState<"" | "sem-presenca" | "faltas">("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [finished, setFinished] = useState(false);
  const [invalidSelection, setInvalidSelection] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<
    Partial<Record<MessageAudience, string>>
  >({});
  const [waitlist, setWaitlist] = useState<WaitlistEntry[] | null>(null);
  const [selectedWaitlistId, setSelectedWaitlistId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<EnrollmentHistoryItem[]>([]);
  const filtered = useMemo(
    () => filterBuscaAtivaStudents(groupData?.enrollments ?? [], search, frequency),
    [groupData, search, frequency],
  );
  const selected =
    finished || invalidSelection
      ? undefined
      : (filtered.find((item) => item.enrollmentId === selectedId) ??
        filtered.find((item) => item.contactEligible) ??
        filtered[0]);
  const position = selected
    ? filtered.findIndex((item) => item.enrollmentId === selected.enrollmentId)
    : -1;
  const selectedWaitlist = waitlist?.find((item) => item.id === selectedWaitlistId);
  const sequence = useRef(0);
  const eligibilityRef = useRef(new Map<string, boolean>());
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const activeKey = `${classGroupId}:${mode}:${mode === "espera" ? selectedWaitlistId : (selected?.enrollmentId ?? selectedId)}`;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;
  function markDirty(value: boolean) {
    setDraftDirty(value);
    onDraftDirtyChange?.(value);
  }
  useEffect(() => {
    if (!draftDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftDirty]);

  const loadQueue = useCallback(
    async (signal?: AbortSignal): Promise<GroupPayload | null> => {
      const requestNumber = ++sequence.current;
      try {
        const response = await fetch(
          `/api/teacher/busca-ativa?classGroupId=${encodeURIComponent(classGroupId)}`,
          { cache: "no-store", signal },
        );
        const json = (await response.json()) as ApiResponse<GroupPayload>;
        if (signal?.aborted || requestNumber !== sequence.current) return null;
        if (!response.ok || !json.ok) {
          setGroupData(null);
          setSelectedId("");
          setError(json.ok ? "Não foi possível carregar a busca ativa." : json.error.message);
          return null;
        }
        const data = json.data;
        setGroupData(data);
        const current = selectedIdRef.current;
        const currentRow = data.enrollments.find((item) => item.enrollmentId === current);
        const wasEligible = eligibilityRef.current.get(current);
        eligibilityRef.current = new Map(
          data.enrollments.map((item) => [item.enrollmentId ?? "", Boolean(item.contactEligible)]),
        );
        if (current && !currentRow) {
          setError("A matrícula selecionada não está mais nesta turma. A lista foi atualizada.");
          setDraftDirty(false);
          onDraftDirtyChange?.(false);
        } else if (currentRow && wasEligible && !currentRow.contactEligible) {
          setError("A situação da matrícula mudou. As ações de contato foram bloqueadas.");
          setDraftDirty(false);
          onDraftDirtyChange?.(false);
        } else setError("");
        setSelectedId(
          currentRow
            ? current
            : (data.enrollments.find((item) => item.contactEligible)?.enrollmentId ??
                data.enrollments[0]?.enrollmentId ??
                ""),
        );
        return data;
      } catch {
        if (!signal?.aborted && requestNumber === sequence.current) {
          setGroupData(null);
          setSelectedId("");
          setError("Falha de rede. Atualize a turma para continuar.");
        }
        return null;
      } finally {
        if (!signal?.aborted && requestNumber === sequence.current) setLoading(false);
      }
    },
    [classGroupId, onDraftDirtyChange],
  );

  useEffect(() => {
    const controller = new AbortController();
    setGroupData(null);
    setSelectedId("");
    setLoading(true);
    setError("");
    void loadQueue(controller.signal).then((data) => {
      if (!data || controller.signal.aborted || !initialEnrollmentId) return;
      if (data.enrollments.some((item) => item.enrollmentId === initialEnrollmentId))
        setSelectedId(initialEnrollmentId);
      else {
        setSelectedId("");
        setInvalidSelection(true);
        setError(
          "A matrícula indicada no link não foi encontrada nesta turma. Escolha um aluno da lista.",
        );
      }
    });
    return () => {
      controller.abort();
      sequence.current += 1;
    };
  }, [loadQueue, initialEnrollmentId]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadQueue();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadQueue]);

  function confirmDiscard(): boolean {
    return !draftDirty || window.confirm("Descartar o texto editado deste aluno?");
  }
  function selectEnrollment(id: string) {
    if (!confirmDiscard()) return false;
    activeKeyRef.current = `${classGroupId}:${mode}:${id}`;
    markDirty(false);
    setFinished(false);
    setInvalidSelection(false);
    setHistoryOpen(false);
    setSelectedId(id);
    return true;
  }
  function navigate(delta: number) {
    if (!confirmDiscard()) return;
    const next = filtered[position + delta];
    markDirty(false);
    if (next?.enrollmentId) {
      activeKeyRef.current = `${classGroupId}:${mode}:${next.enrollmentId}`;
      setHistoryOpen(false);
      setSelectedId(next.enrollmentId);
    } else if (delta > 0 && position === filtered.length - 1) setFinished(true);
  }
  function changeMode(next: Mode) {
    if (!confirmDiscard()) return;
    markDirty(false);
    setMode(next);
    setError("");
    if (next === "espera" && !waitlist) void loadWaitlist();
  }

  async function refreshContext(): Promise<MessageContext | null> {
    const expected = activeKeyRef.current;
    const enrollmentId = selected?.enrollmentId;
    const data = await loadQueue();
    if (!data || activeKeyRef.current !== expected) return null;
    if (mode === "turma") return data.group;
    if (!enrollmentId) return null;
    const latest = data.enrollments.find((item) => item.enrollmentId === enrollmentId);
    if (!latest || !latest.contactEligible) {
      setError("Esta matrícula não permite contato pela busca ativa. Atualize a turma.");
      markDirty(false);
      return null;
    }
    return latest;
  }

  async function handleSaved(advance: boolean, savedId: string) {
    const data = await loadQueue();
    if (!data || activeKeyRef.current !== `${classGroupId}:${mode}:${savedId}`) return;
    markDirty(false);
    if (advance) {
      const queue = filterBuscaAtivaStudents(data.enrollments, search, frequency).filter(
        (item) => item.contactEligible,
      );
      const index = queue.findIndex((item) => item.enrollmentId === savedId);
      const next = queue[index < 0 ? 0 : index + 1];
      if (next?.enrollmentId) {
        activeKeyRef.current = `${classGroupId}:${mode}:${next.enrollmentId}`;
        setSelectedId(next.enrollmentId);
      } else setFinished(true);
    }
  }

  async function loadWaitlist(): Promise<WaitlistEntry[] | null> {
    try {
      const response = await fetch(
        `/api/teacher/class-groups/${encodeURIComponent(classGroupId)}/waitlist`,
        { cache: "no-store" },
      );
      const json = (await response.json()) as ApiResponse<{
        waitlist: { entries: WaitlistEntry[] };
      }>;
      if (!response.ok || !json.ok) {
        setError(json.ok ? "Não foi possível carregar a lista de espera." : json.error.message);
        return null;
      }
      setWaitlist(json.data.waitlist.entries);
      setSelectedWaitlistId((current) =>
        json.data.waitlist.entries.some((item) => item.id === current)
          ? current
          : (json.data.waitlist.entries[0]?.id ?? ""),
      );
      return json.data.waitlist.entries;
    } catch {
      setError("Falha de rede ao carregar a lista de espera.");
      return null;
    }
  }
  function waitlistContext(entry: WaitlistEntry, group: MessageContext): MessageContext {
    return {
      ...group,
      waitlistId: entry.id,
      studentName: entry.studentName,
      studentPhone: entry.studentPhone,
      revision: [
        group.revision,
        entry.id,
        entry.createdAt,
        entry.studentName,
        entry.studentPhone ?? "",
      ].join(":"),
    };
  }
  async function refreshWaitlistContext(): Promise<MessageContext | null> {
    const expected = activeKeyRef.current;
    const [data, entries] = await Promise.all([loadQueue(), loadWaitlist()]);
    if (!data || !entries || activeKeyRef.current !== expected) return null;
    const entry = entries.find((item) => item.id === selectedWaitlistId);
    if (!entry) {
      setError("Esta pessoa não está mais na lista de espera.");
      return null;
    }
    return waitlistContext(entry, data.group);
  }
  async function openHistory() {
    if (!selected?.enrollmentId) return;
    const expected = activeKeyRef.current;
    const enrollmentId = selected.enrollmentId;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const response = await fetch(
        `/api/teacher/class-groups/${encodeURIComponent(classGroupId)}/enrollments`,
        { cache: "no-store" },
      );
      const json = (await response.json()) as ApiResponse<{
        enrollments: { id: string; history?: EnrollmentHistoryItem[] }[];
      }>;
      if (activeKeyRef.current !== expected) return;
      if (!response.ok || !json.ok) {
        setError("Não foi possível carregar o histórico.");
        return;
      }
      setHistory(json.data.enrollments.find((item) => item.id === enrollmentId)?.history ?? []);
    } catch {
      setError("Falha de rede ao carregar o histórico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <main className="min-w-0 space-y-4 text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            Busca ativa · {groupData?.enrollments.length ?? 0} alunos da turma
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {groupData?.enrollments.filter((item) => item.contactEligible).length ?? 0} aptos para
            contato; demais matrículas apenas para consulta. Copiar ou abrir WhatsApp não registra contato.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setLoading(true);
            void loadQueue();
          }}
        >
          Atualizar fila
        </Button>
      </div>
      {loading && !groupData ? <p role="status">Carregando alunos da turma…</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-amber-500 p-3 text-sm">
          {error}
        </p>
      ) : null}
      {groupData ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={mode === "aluno" ? "primary" : "secondary"}
              onClick={() => changeMode("aluno")}
            >
              Mensagem individual
            </Button>
            <details className="relative">
              <summary className="cursor-pointer rounded-md border border-[var(--card-border)] px-3 py-2 text-sm">
                Outras ações
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => changeMode("interno")}>
                  Registro interno
                </Button>
                <Button type="button" variant="secondary" onClick={() => changeMode("turma")}>
                  Mensagem para a turma
                </Button>
                <Button type="button" variant="secondary" onClick={() => changeMode("espera")}>
                  Lista de espera
                </Button>
              </div>
            </details>
          </div>
          {mode === "turma" ? (
            <section className="rounded-lg border border-[var(--card-border)] p-4">
              <p className="mb-3 text-xs text-[var(--text-muted)]">
                Texto coletivo, sem dados individuais. Copie e publique manualmente.
              </p>
              <BuscaAtivaComposer
                key={`${classGroupId}:turma`}
                context={groupData.group}
                audience="turma"
                refresh={refreshContext}
                initialTemplateId={selectedTemplates.turma}
                onTemplateChange={(id) => setSelectedTemplates((old) => ({ ...old, turma: id }))}
                onDirtyChange={markDirty}
                compact
              />
            </section>
          ) : mode === "espera" ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.4fr)]">
              <section className="rounded-lg border border-[var(--card-border)] p-3">
                <h3 className="mb-2 font-medium">Lista de espera</h3>
                {!waitlist ? (
                  <p>Carregando…</p>
                ) : waitlist.length === 0 ? (
                  <p>Nenhuma pessoa aguardando nesta turma.</p>
                ) : (
                  <ul className="space-y-2">
                    {waitlist.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="w-full rounded-md border border-[var(--card-border)] p-2 text-left"
                          aria-current={selectedWaitlistId === entry.id ? "true" : undefined}
                          onClick={() => {
                            if (confirmDiscard()) {
                              markDirty(false);
                              setSelectedWaitlistId(entry.id);
                            }
                          }}
                        >
                          {entry.studentName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="min-w-0 rounded-lg border border-[var(--card-border)] p-4">
                {selectedWaitlist ? (
                  <BuscaAtivaComposer
                    key={`${classGroupId}:espera:${selectedWaitlist.id}`}
                    context={waitlistContext(selectedWaitlist, groupData.group)}
                    audience="aluno"
                    refresh={refreshWaitlistContext}
                    initialTemplateId="lista-espera"
                    allowedTemplateIds={["lista-espera"]}
                    onDirtyChange={markDirty}
                    compact
                  />
                ) : (
                  <p>Selecione uma pessoa da lista de espera.</p>
                )}
              </section>
            </div>
          ) : (
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.4fr)]">
              <section
                className="min-w-0 rounded-lg border border-[var(--card-border)] p-3"
                aria-label="Alunos da turma"
              >
                <label className="block text-sm">
                  Buscar nome
                  <input
                    className="theme-input mt-1 w-full rounded-md border px-3 py-2"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer">Mais filtros</summary>
                  <label className="mt-2 block">
                    Frequência
                    <select
                      className="theme-input mt-1 w-full rounded-md border px-3 py-2"
                      value={frequency}
                      onChange={(event) =>
                        setFrequency(event.target.value as "" | "sem-presenca" | "faltas")
                      }
                    >
                      <option value="">Todos os alunos</option>
                      <option value="sem-presenca">Sem presença, com aulas contabilizadas</option>
                      <option value="faltas">Com faltas registradas</option>
                    </select>
                  </label>
                </details>
                <p className="my-3 text-xs text-[var(--text-muted)]">
                  {filtered.length} de {groupData.enrollments.length} alunos da turma
                </p>
                {groupData.enrollments.length === 0 ? (
                  <p>Não há alunos nesta turma.</p>
                ) : filtered.length === 0 ? (
                  <p>Nenhum aluno corresponde à busca.</p>
                ) : (
                  <>
                    <label className="block text-sm lg:hidden">
                      Aluno da turma
                      <select
                        className="theme-input mt-1 w-full rounded-md border px-3 py-2"
                        value={selected?.enrollmentId ?? ""}
                        onChange={(event) => {
                          if (!selectEnrollment(event.target.value))
                            event.currentTarget.value = selected?.enrollmentId ?? "";
                        }}
                      >
                        {!selected ? (
                          <option value="" disabled>
                            Escolha um aluno
                          </option>
                        ) : null}
                        {filtered.map((item) => (
                          <option key={item.enrollmentId} value={item.enrollmentId}>
                            {item.studentName}
                            {!item.contactEligible ? ` · ${enrollmentStatusLabel(item)}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <ul className="hidden space-y-2 lg:block">
                      {filtered.map((item) => (
                        <li key={item.enrollmentId}>
                          <button
                            type="button"
                            className={`w-full rounded-md border p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-[var(--igh-primary)] ${selected?.enrollmentId === item.enrollmentId ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10" : "border-[var(--card-border)]"}`}
                            aria-current={
                              selected?.enrollmentId === item.enrollmentId ? "true" : undefined
                            }
                            onClick={() => selectEnrollment(item.enrollmentId ?? "")}
                          >
                            <strong className="block">{item.studentName}</strong>
                            {!item.contactEligible ? (
                              <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">
                                {enrollmentStatusLabel(item)} · apenas consulta
                              </span>
                            ) : null}
                            <span className="block text-xs text-[var(--text-muted)]">
                              {item.attendanceTotalSessions
                                ? `Frequência: ${item.attendancePresentCount}/${item.attendanceTotalSessions}${item.attendanceRecordedCount !== item.attendanceTotalSessions ? " · lançamento incompleto" : ""}`
                                : "Frequência ainda não contabilizada"}
                            </span>
                            {item.history?.[0] ? (
                              <span className="block text-xs text-[var(--text-muted)]">
                                Registro:{" "}
                                {formatCalendarDate(
                                  item.history[0].factDate ??
                                    item.history[0].createdAt.slice(0, 10),
                                )}
                                {item.history[0].result &&
                                Object.hasOwn(RESULT_LABELS, item.history[0].result)
                                  ? ` · ${RESULT_LABELS[item.history[0].result as keyof typeof RESULT_LABELS]}`
                                  : ""}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
              <section
                className="min-w-0 rounded-lg border border-[var(--card-border)] p-4"
                aria-label="Mensagem do aluno"
              >
                {finished ? (
                  <div>
                    <p>Fim da lista visível. Isso não confirma que todos foram contatados.</p>
                    <Button
                      type="button"
                      className="mt-3"
                      variant="secondary"
                      onClick={() => {
                        setFinished(false);
                        setSelectedId(filtered[0]?.enrollmentId ?? "");
                      }}
                    >
                      Voltar ao início
                    </Button>
                  </div>
                ) : selected ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        Aluno {position + 1} de {filtered.length}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={position <= 0}
                          onClick={() => navigate(-1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(1)}
                        >
                          {position === filtered.length - 1 ? "Concluir percurso" : "Próximo"}
                        </Button>
                      </div>
                    </div>
                    {selected.contactEligible ? (
                      <>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>{selected.studentPhone || "Telefone não informado"}</span>
                          <button
                            type="button"
                            className="text-[var(--igh-primary)] underline"
                            onClick={() => void openHistory()}
                          >
                            Ver histórico
                          </button>
                        </div>
                        <BuscaAtivaComposer
                          key={`${classGroupId}:${selected.enrollmentId}:${mode}`}
                          context={selected}
                          audience={mode}
                          refresh={refreshContext}
                          onSaved={(advance) =>
                            void handleSaved(Boolean(advance), selected.enrollmentId!)
                          }
                          initialTemplateId={selectedTemplates[mode]}
                          onTemplateChange={(id) =>
                            setSelectedTemplates((old) => ({ ...old, [mode]: id }))
                          }
                          onDirtyChange={markDirty}
                          compact
                        />
                      </>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <h3 className="font-semibold">{selected.studentName}</h3>
                        <p>{enrollmentStatusLabel(selected)}. Mensagem e registro de contato indisponíveis nesta matrícula.</p>
                        <button
                          type="button"
                          className="text-[var(--igh-primary)] underline"
                          onClick={() => void openHistory()}
                        >
                          Ver histórico
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p>Selecione um aluno da turma.</p>
                )}
              </section>
            </div>
          )}
        </>
      ) : null}
      <Modal
        open={historyOpen}
        title={`Histórico de ${selected?.studentName ?? "aluno"}`}
        size="large"
        onClose={() => setHistoryOpen(false)}
      >
        {historyLoading ? (
          <p>Carregando histórico…</p>
        ) : selected?.enrollmentId ? (
          <EnrollmentFollowUp
            classGroupId={classGroupId}
            enrollmentId={selected.enrollmentId}
            studentName={selected.studentName ?? "Aluno"}
            history={history}
            onAdded={() => void openHistory()}
            readOnly
          />
        ) : (
          <p>Seleção indisponível.</p>
        )}
      </Modal>
    </main>
  );
}
