"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiErr, ApiResponse } from "@/lib/api-types";

type PoolItem = { id: string; question: string; lessonTitle: string };

type ReusableExam = {
  id: string;
  title: string;
  classGroupLabel: string;
  status: string;
  questionCount: number;
  durationMinutes: number;
  timingMode: "FROM_STUDENT_START" | "FROM_EXAM_START";
  selectionMode: "RANDOM" | "MANUAL";
  instructions: string | null;
  manualExerciseIds: string[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  showScoreAfterSubmit: boolean;
  availableFrom: string;
  availableUntil: string;
};

function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProfessorExamEditor({
  classGroupId,
  examId,
}: {
  classGroupId: string;
  examId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const isNew = !examId;

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timingMode, setTimingMode] = useState<"FROM_STUDENT_START" | "FROM_EXAM_START">("FROM_STUDENT_START");
  const [selectionMode, setSelectionMode] = useState<"RANDOM" | "MANUAL">("RANDOM");
  const [questionCount, setQuestionCount] = useState(10);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [status, setStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [reusableExams, setReusableExams] = useState<ReusableExam[]>([]);
  const [selectedReuseId, setSelectedReuseId] = useState("");
  const [replicating, setReplicating] = useState(false);

  const loadPool = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams/pool`);
    const json = (await res.json()) as ApiResponse<{ items: PoolItem[]; total: number }>;
    if (res.ok && json.ok) setPool(json.data.items);
  }, [classGroupId]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  useEffect(() => {
    if (!isNew) return;
    void (async () => {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams/reusable`);
      const json = (await res.json()) as ApiResponse<{ items: ReusableExam[] }>;
      if (res.ok && json.ok) setReusableExams(json.data.items);
    })();
  }, [isNew, classGroupId]);

  function applyReusableTemplate(item: ReusableExam) {
    setTitle(item.title);
    setInstructions(item.instructions ?? "");
    setAvailableFrom(toLocalInput(item.availableFrom));
    setAvailableUntil(toLocalInput(item.availableUntil));
    setDurationMinutes(item.durationMinutes);
    setTimingMode(item.timingMode);
    setSelectionMode(item.selectionMode);
    setQuestionCount(item.questionCount);
    setManualIds(item.manualExerciseIds ?? []);
    setShuffleQuestions(item.shuffleQuestions);
    setShuffleOptions(item.shuffleOptions);
    toast.push("success", "Configuração carregada. Ajuste as datas para esta turma e salve.");
  }

  async function replicateAsDraft() {
    if (!selectedReuseId) {
      toast.push("error", "Selecione uma prova para reutilizar.");
      return;
    }
    setReplicating(true);
    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams/replicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceExamId: selectedReuseId }),
      });
      const json = (await res.json()) as ApiResponse<{ id: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao reutilizar.");
        return;
      }
      toast.push("success", "Rascunho criado a partir da prova selecionada.");
      router.push(`/professor/turmas/${classGroupId}/provas/${json.data.id}`);
    } finally {
      setReplicating(false);
    }
  }

  useEffect(() => {
    if (!examId) return;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams/${examId}`);
      const json = (await res.json()) as ApiResponse<{
        exam: {
          title: string;
          instructions: string | null;
          availableFrom: string;
          availableUntil: string;
          durationMinutes: number;
          timingMode: "FROM_STUDENT_START" | "FROM_EXAM_START";
          selectionMode: "RANDOM" | "MANUAL";
          questionCount: number;
          manualExerciseIds: string[];
          shuffleQuestions: boolean;
          shuffleOptions: boolean;
          status: string;
        };
      }>;
      if (res.ok && json.ok) {
        const e = json.data.exam;
        setTitle(e.title);
        setInstructions(e.instructions ?? "");
        setAvailableFrom(toLocalInput(e.availableFrom));
        setAvailableUntil(toLocalInput(e.availableUntil));
        setDurationMinutes(e.durationMinutes);
        setTimingMode(e.timingMode);
        setSelectionMode(e.selectionMode);
        setQuestionCount(e.questionCount);
        setManualIds(e.manualExerciseIds ?? []);
        setShuffleQuestions(e.shuffleQuestions);
        setShuffleOptions(e.shuffleOptions);
        setStatus(e.status);
      }
      setLoading(false);
    })();
  }, [examId, classGroupId]);

  function buildBody() {
    return {
      title,
      instructions: instructions.trim() || null,
      availableFrom: new Date(availableFrom).toISOString(),
      availableUntil: new Date(availableUntil).toISOString(),
      durationMinutes,
      timingMode,
      selectionMode,
      questionCount,
      manualExerciseIds: selectionMode === "MANUAL" ? manualIds.slice(0, questionCount) : [],
      shuffleQuestions,
      shuffleOptions,
    };
  }

  async function save() {
    if (!title.trim()) {
      toast.push("error", "Título é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const url = isNew
        ? `/api/teacher/class-groups/${classGroupId}/exams`
        : `/api/teacher/class-groups/${classGroupId}/exams/${examId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const json = (await res.json()) as ApiResponse<{ id: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Prova salva.");
      router.push(`/professor/turmas/${classGroupId}/provas/${json.data.id}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleManual(id: string) {
    setManualIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  const readOnly = status !== "DRAFT";

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/professor/turmas/${classGroupId}/provas`} className="text-sm text-[var(--igh-primary)] hover:underline">
        ← Provas da turma
      </Link>

      <h1 className="text-2xl font-bold text-[var(--text-primary)]">{isNew ? "Nova prova" : "Editar prova"}</h1>

      {isNew && reusableExams.length > 0 && (
        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Reutilizar prova de outra turma</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Mesmo curso, provas que você criou em outras turmas. Copie a configuração ou gere um rascunho nesta turma.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="text-sm font-medium">Prova modelo</label>
              <select
                className="theme-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={selectedReuseId}
                onChange={(e) => setSelectedReuseId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {reusableExams.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} — {r.classGroupLabel} ({r.questionCount} questões)
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedReuseId}
              onClick={() => {
                const item = reusableExams.find((r) => r.id === selectedReuseId);
                if (item) applyReusableTemplate(item);
              }}
            >
              Preencher formulário
            </Button>
            <Button type="button" disabled={!selectedReuseId || replicating} onClick={() => void replicateAsDraft()}>
              {replicating ? "Criando…" : "Criar rascunho aqui"}
            </Button>
          </div>
        </section>
      )}

      {readOnly && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40">
          Prova já publicada: só é possível ver resultados na lista de tentativas abaixo (edição bloqueada).
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Título</label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Instruções para o aluno</label>
          <textarea
            className="theme-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Disponível a partir de</label>
          <Input
            type="datetime-local"
            className="mt-1"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Disponível até (último momento para iniciar)</label>
          <Input
            type="datetime-local"
            className="mt-1"
            value={availableUntil}
            onChange={(e) => setAvailableUntil(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Duração (minutos)</label>
          <Input
            type="number"
            min={1}
            className="mt-1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 60)}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Contagem do tempo</label>
          <select
            className="theme-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={timingMode}
            onChange={(e) => setTimingMode(e.target.value as typeof timingMode)}
            disabled={readOnly}
          >
            <option value="FROM_STUDENT_START">A partir do clique em Iniciar (aluno)</option>
            <option value="FROM_EXAM_START">A partir do horário de início da prova</option>
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            No modo «horário de início», quem entrar atrasado terá menos tempo (até o fim da duração contada do início
            oficial).
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Questões</label>
          <select
            className="theme-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={selectionMode}
            onChange={(e) => setSelectionMode(e.target.value as typeof selectionMode)}
            disabled={readOnly}
          >
            <option value="RANDOM">Aleatórias do banco do curso</option>
            <option value="MANUAL">Escolher manualmente</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Quantidade de questões</label>
          <Input
            type="number"
            min={1}
            className="mt-1"
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value, 10) || 1)}
            disabled={readOnly}
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">Banco disponível: {pool.length} questões válidas</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} disabled={readOnly} />
          Embaralhar ordem das questões
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} disabled={readOnly} />
          Embaralhar alternativas
        </label>
      </div>

      {selectionMode === "MANUAL" && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--card-border)] p-3">
          <p className="mb-2 text-sm font-medium">Selecione as questões ({manualIds.length} marcadas)</p>
          <ul className="space-y-2">
            {pool.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={manualIds.includes(p.id)}
                    onChange={() => toggleManual(p.id)}
                    disabled={readOnly}
                  />
                  <span>
                    <span className="text-xs text-[var(--text-muted)]">{p.lessonTitle} — </span>
                    {p.question}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!readOnly && (
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar rascunho"}
        </Button>
      )}
    </div>
  );
}
