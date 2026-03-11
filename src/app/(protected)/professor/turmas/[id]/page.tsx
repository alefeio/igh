"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import { AlertCircle } from "lucide-react";

type ClassGroup = {
  id: string;
  courseName: string;
  startDate: string;
  startTime: string;
  endTime: string;
  status: string;
  enrollmentsCount: number;
  capacity: number;
};

type Enrollment = {
  id: string;
  studentName: string;
  studentEmail: string | null;
  enrolledAt: string;
  documentationAlert: "yellow" | "red" | null;
};

type Session = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  lessonTitle: string | null;
  canTakeAttendance: boolean;
};

type AttendanceRow = {
  enrollmentId: string;
  studentName: string;
  present: boolean;
  documentationAlert: "yellow" | "red" | null;
};

type ExerciseByEnrollment = {
  enrollmentId: string;
  studentName: string;
  answers: { lessonTitle: string; question: string; correct: boolean }[];
  totalCorrect: number;
  totalAttempts: number;
};

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ProfessorTurmaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const [classGroup, setClassGroup] = useState<ClassGroup | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exerciseByEnrollment, setExerciseByEnrollment] = useState<ExerciseByEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"alunos" | "exercicios" | "frequencia">("alunos");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const loadClassGroup = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${id}`);
    const json = (await res.json()) as ApiResponse<{ classGroup: ClassGroup }>;
    if (res.ok && json?.ok) setClassGroup(json.data.classGroup);
    else setClassGroup(null);
  }, [id]);

  const loadEnrollments = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${id}/enrollments`);
    const json = (await res.json()) as ApiResponse<{ enrollments: Enrollment[] }>;
    if (res.ok && json?.ok) setEnrollments(json.data.enrollments);
  }, [id]);

  const loadSessions = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${id}/sessions`);
    const json = (await res.json()) as ApiResponse<{ sessions: Session[] }>;
    if (res.ok && json?.ok) setSessions(json.data.sessions);
  }, [id]);

  const loadExerciseAnswers = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${id}/exercise-answers`);
    const json = (await res.json()) as ApiResponse<{ byEnrollment: ExerciseByEnrollment[] }>;
    if (res.ok && json?.ok) setExerciseByEnrollment(json.data.byEnrollment ?? []);
  }, [id]);

  const loadAttendance = useCallback(
    async (sessionId: string) => {
      const res = await fetch(`/api/teacher/class-groups/${id}/sessions/${sessionId}/attendance`);
      const json = (await res.json()) as ApiResponse<{ attendance: AttendanceRow[] }>;
      if (res.ok && json?.ok) setAttendance(json.data.attendance ?? []);
      else setAttendance([]);
    },
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        await Promise.all([loadClassGroup(), loadEnrollments(), loadSessions(), loadExerciseAnswers()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadClassGroup, loadEnrollments, loadSessions, loadExerciseAnswers]);

  useEffect(() => {
    if (selectedSessionId) loadAttendance(selectedSessionId);
    else setAttendance([]);
  }, [selectedSessionId, loadAttendance]);

  const handleTogglePresent = (enrollmentId: string) => {
    setAttendance((prev) =>
      prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, present: !r.present } : r))
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedSessionId) return;
    setSavingAttendance(true);
    try {
      const res = await fetch(
        `/api/teacher/class-groups/${id}/sessions/${selectedSessionId}/attendance`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendance: attendance.map((r) => ({ enrollmentId: r.enrollmentId, present: r.present })),
          }),
        }
      );
      const json = (await res.json()) as ApiResponse<unknown>;
      if (res.ok && json?.ok) toast.push("success", "Frequência salva.");
      else toast.push("error", json && "error" in json ? (json.error as { message?: string }).message : "Erro ao salvar.");
    } finally {
      setSavingAttendance(false);
    }
  };

  if (loading && !classGroup) {
    return (
      <div className="container-page flex justify-center py-12">
        <p className="text-[var(--text-muted)]">Carregando...</p>
      </div>
    );
  }
  if (!classGroup) {
    return (
      <div className="container-page flex flex-col gap-4 py-8">
        <p className="text-[var(--text-muted)]">Turma não encontrada.</p>
        <Link href="/professor/turmas" className="text-[var(--igh-primary)] hover:underline">
          ← Voltar às turmas
        </Link>
      </div>
    );
  }

  const sessionsWithLesson = sessions.filter((s) => s.status === "LIBERADA");

  return (
    <div className="container-page flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/professor/turmas" className="text-sm text-[var(--igh-primary)] hover:underline">
            ← Turmas que leciono
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            {classGroup.courseName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {classGroup.enrollmentsCount} alunos · Início {formatDate(classGroup.startDate)}
            {classGroup.startTime && classGroup.endTime && ` · ${classGroup.startTime} – ${classGroup.endTime}`}
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-[var(--card-border)] pb-2">
        <button
          type="button"
          onClick={() => setTab("alunos")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "alunos"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
          }`}
        >
          Lista de alunos
        </button>
        <button
          type="button"
          onClick={() => setTab("exercicios")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "exercicios"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
          }`}
        >
          Exercícios realizados
        </button>
        <button
          type="button"
          onClick={() => setTab("frequencia")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "frequencia"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
          }`}
        >
          Frequência
        </button>
      </nav>

      {tab === "alunos" && (
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
          <h2 className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Alunos da turma
          </h2>
          {enrollments.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Nenhum aluno matriculado.</p>
          ) : (
            <ul className="divide-y divide-[var(--card-border)]">
              {enrollments.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {e.documentationAlert && (
                      <span
                        title={e.documentationAlert === "red" ? "Dados incompletos e documentação faltando" : "Documentação incompleta (identidade e/ou comprovante de residência)"}
                        className="inline-flex shrink-0"
                      >
                        <AlertCircle
                          className={`h-5 w-5 ${e.documentationAlert === "red" ? "text-red-600" : "text-amber-500"}`}
                          aria-hidden
                        />
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{e.studentName}</p>
                      {e.studentEmail && (
                        <p className="text-xs text-[var(--text-muted)]">{e.studentEmail}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    Matrícula em {formatDate(e.enrolledAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "exercicios" && (
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
          <h2 className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Exercícios realizados pelos alunos
          </h2>
          {exerciseByEnrollment.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">
              Nenhum exercício respondido ainda.
            </p>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {exerciseByEnrollment.map((row) => (
                <div key={row.enrollmentId} className="p-4">
                  <p className="font-medium text-[var(--text-primary)]">{row.studentName}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.totalCorrect} acertos em {row.totalAttempts} tentativas
                  </p>
                  {row.answers.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4 text-sm text-[var(--text-secondary)]">
                      {row.answers.slice(0, 10).map((a, i) => (
                        <li key={i}>
                          {a.lessonTitle}: {a.question.slice(0, 50)}
                          {a.question.length > 50 ? "…" : ""} —{" "}
                          <span className={a.correct ? "text-green-600" : "text-amber-600"}>
                            {a.correct ? "Acerto" : "Erro"}
                          </span>
                        </li>
                      ))}
                      {row.answers.length > 10 && (
                        <li className="text-[var(--text-muted)]">
                          + {row.answers.length - 10} respostas
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "frequencia" && (
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
          <h2 className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Frequência (aulas liberadas)
          </h2>
          <p className="px-4 py-2 text-xs text-[var(--text-muted)]">
            Selecione uma sessão com aula liberada para marcar presença.
          </p>
          <div className="flex flex-wrap gap-2 p-4">
            {sessionsWithLesson.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma sessão com aula liberada ainda.
              </p>
            ) : (
              sessionsWithLesson.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    selectedSessionId === s.id
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                >
                  {formatDate(s.sessionDate)} — {s.lessonTitle ?? "Aula"}
                </button>
              ))
            )}
          </div>
          {selectedSessionId && attendance.length > 0 && (
            <div className="border-t border-[var(--card-border)] p-4">
              <p className="mb-3 text-sm font-medium text-[var(--text-primary)]">
                Marque presença (presente / ausente)
              </p>
              <ul className="space-y-2">
                {attendance.map((row) => (
                  <li
                    key={row.enrollmentId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--card-border)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {row.documentationAlert && (
                        <span
                          title={row.documentationAlert === "red" ? "Dados incompletos e documentação faltando" : "Documentação incompleta (identidade e/ou comprovante de residência)"}
                          className="inline-flex shrink-0"
                        >
                          <AlertCircle
                            className={`h-5 w-5 ${row.documentationAlert === "red" ? "text-red-600" : "text-amber-500"}`}
                            aria-hidden
                          />
                        </span>
                      )}
                      <span className="text-sm text-[var(--text-primary)] truncate">{row.studentName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePresent(row.enrollmentId)}
                      className={`rounded px-3 py-1 text-sm font-medium ${
                        row.present
                          ? "bg-green-600 text-white"
                          : "bg-[var(--igh-surface)] text-[var(--text-muted)]"
                      }`}
                    >
                      {row.present ? "Presente" : "Ausente"}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Button
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance}
                  className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm text-white"
                >
                  {savingAttendance ? "Salvando..." : "Salvar frequência"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
