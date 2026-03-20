"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import { AlertCircle, Presentation } from "lucide-react";

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
  /** Data de nascimento no formato YYYY-MM-DD (só data). */
  studentBirthDate?: string | null;
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
  /** Texto livre quando ausente; vazio ou null se não houver justificativa. */
  absenceJustification: string | null;
  documentationAlert: "yellow" | "red" | null;
};

type ExerciseByEnrollment = {
  enrollmentId: string;
  studentName: string;
  answers: {
    id: string;
    exerciseId: string;
    lessonId: string;
    lessonTitle: string;
    question: string;
    correct: boolean;
    createdAt: string;
    attemptIndex?: number;
    totalAttemptsForExercise?: number;
  }[];
  totalCorrect: number;
  totalAttempts: number;
};

type LessonProgressItem = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  completed: boolean;
  completedAt: string | null;
  lastAccessedAt: string | null;
  totalMinutesStudied: number;
  percentWatched: number;
  percentRead: number;
};

type LessonProgressByEnrollment = {
  enrollmentId: string;
  studentName: string;
  studentId: string;
  progress: LessonProgressItem[];
};

/** Formata data (YYYY-MM-DD ou ISO) para pt-BR sem mudança de fuso: evita dia anterior em datas só-dia. */
function formatDate(s: string) {
  const datePart = s.trim().split("T")[0];
  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m} min` : `${h}h`;
}

export default function ProfessorTurmaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const user = useUser();
  const [classGroup, setClassGroup] = useState<ClassGroup | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exerciseByEnrollment, setExerciseByEnrollment] = useState<ExerciseByEnrollment[]>([]);
  const [lessonProgressByEnrollment, setLessonProgressByEnrollment] = useState<LessonProgressByEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"alunos" | "exercicios" | "aulas" | "frequencia" | "duvidas">("alunos");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  type ProfLessonQuestion = {
    id: string;
    lessonId: string;
    lessonTitle: string;
    moduleTitle: string;
    content: string;
    createdAt: string;
    authorName: string;
    teacherReplies: { id: string; content: string; createdAt: string; teacherName: string }[];
  };
  const [lessonQuestions, setLessonQuestions] = useState<ProfLessonQuestion[]>([]);
  const [loadingDuvidas, setLoadingDuvidas] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReplyQuestionId, setSavingReplyQuestionId] = useState<string | null>(null);

  const attendanceSorted = useMemo(
    () =>
      [...attendance].sort((a, b) =>
        a.studentName.localeCompare(b.studentName, "pt-BR", { sensitivity: "base" })
      ),
    [attendance]
  );

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

  const loadLessonProgress = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${id}/lesson-progress`);
    const json = (await res.json()) as ApiResponse<{ byEnrollment: LessonProgressByEnrollment[] }>;
    if (res.ok && json?.ok) setLessonProgressByEnrollment(json.data.byEnrollment ?? []);
  }, [id]);

  const loadLessonQuestions = useCallback(async () => {
    setLoadingDuvidas(true);
    try {
      const res = await fetch(`/api/teacher/class-groups/${id}/lesson-questions`);
      const json = (await res.json()) as ApiResponse<{ questions: ProfLessonQuestion[] }>;
      if (res.ok && json?.ok) setLessonQuestions(json.data.questions ?? []);
      else setLessonQuestions([]);
    } finally {
      setLoadingDuvidas(false);
    }
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

  useEffect(() => {
    if (tab === "aulas") loadLessonProgress();
  }, [tab, loadLessonProgress]);

  useEffect(() => {
    if (tab === "duvidas") void loadLessonQuestions();
  }, [tab, loadLessonQuestions]);

  const handleSendTeacherReply = async (questionId: string) => {
    const content = (replyDrafts[questionId] ?? "").trim();
    if (!content) {
      toast.push("error", "Digite a resposta.");
      return;
    }
    setSavingReplyQuestionId(questionId);
    try {
      const res = await fetch(`/api/teacher/class-groups/${id}/lesson-questions/${questionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = (await res.json()) as ApiResponse<{
        id: string;
        content: string;
        createdAt: string;
        teacherName: string;
      }>;
      if (res.ok && json?.ok && json.data) {
        toast.push("success", "Resposta publicada.");
        setReplyDrafts((d) => ({ ...d, [questionId]: "" }));
        setLessonQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  teacherReplies: [
                    ...q.teacherReplies,
                    {
                      id: json.data!.id,
                      content: json.data!.content,
                      createdAt: json.data!.createdAt,
                      teacherName: json.data!.teacherName,
                    },
                  ],
                }
              : q
          )
        );
      } else {
        toast.push(
          "error",
          json && "error" in json ? (json.error as { message?: string }).message ?? "Erro ao enviar." : "Erro ao enviar."
        );
      }
    } finally {
      setSavingReplyQuestionId(null);
    }
  };

  const handleTogglePresent = (enrollmentId: string) => {
    setAttendance((prev) =>
      prev.map((r) => {
        if (r.enrollmentId !== enrollmentId) return r;
        const nextPresent = !r.present;
        return {
          ...r,
          present: nextPresent,
          absenceJustification: nextPresent ? null : r.absenceJustification,
        };
      })
    );
  };

  const handleAbsenceJustificationChange = (enrollmentId: string, value: string) => {
    setAttendance((prev) =>
      prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, absenceJustification: value } : r))
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
            attendance: attendance.map((r) => ({
              enrollmentId: r.enrollmentId,
              present: r.present,
              absenceJustification: r.present ? null : r.absenceJustification,
            })),
          }),
        }
      );
      const json = (await res.json()) as ApiResponse<{ attendance: AttendanceRow[] }>;
      if (res.ok && json?.ok) {
        if (json.data?.attendance) setAttendance(json.data.attendance);
        toast.push("success", "Frequência salva.");
      }
      else {
        const msg =
          json && "error" in json
            ? ((json.error as { message?: string }).message ?? "Erro ao salvar.")
            : "Erro ao salvar.";
        toast.push("error", msg);
        if (res.status === 403) {
          toast.push("error", "Essa sessão ainda não está com aula liberada (status diferente de LIBERADA).");
        }
      }
    } finally {
      setSavingAttendance(false);
    }
  };

  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!classGroup) return [];
    return [
      {
        target: "[data-tour=\"pt-voltar\"]",
        title: "Voltar às turmas",
        content: "Use este link para retornar à lista de turmas que você leciona.",
      },
      {
        target: "[data-tour=\"pt-header\"]",
        title: "Detalhes da turma",
        content:
          "Aqui aparecem o nome do curso, a quantidade de alunos e a data/horário de início. Use Modo apresentação para abrir slides e material da aula em sala.",
      },
      {
        target: "[data-tour=\"pt-apresentar\"]",
        title: "Modo apresentação",
        content:
          "Abre o conteúdo do curso em formato adequado para projetor ou compartilhamento de tela: slides, vídeo, material complementar e gabarito dos exercícios (somente leitura).",
      },
      {
        target: "[data-tour=\"pt-tabs\"]",
        title: "Abas da turma",
        content:
          "Use as abas para alternar entre: lista de alunos, exercícios realizados, progresso nas aulas, frequência (presenças) e dúvidas dos alunos no fórum das aulas.",
      },
      {
        target: "[data-tour=\"pt-tab-alunos\"]",
        title: "Lista de alunos",
        content: "Veja os alunos matriculados nesta turma. Alertas em amarelo ou vermelho indicam documentação incompleta.",
      },
      {
        target: "[data-tour=\"pt-tab-exercicios\"]",
        title: "Exercícios realizados",
        content: "Acompanhe as respostas dos alunos aos exercícios das aulas: acertos, erros e tentativas por questão.",
      },
      {
        target: "[data-tour=\"pt-tab-aulas\"]",
        title: "Aulas assistidas",
        content: "Veja o progresso de cada aluno nas aulas: conclusão, último acesso e tempo de estudo.",
      },
      {
        target: "[data-tour=\"pt-tab-frequencia\"]",
        title: "Frequência",
        content:
          "Selecione uma sessão com aula liberada e marque presença (presente/ausente) de cada aluno, em ordem alfabética. Para ausências, você pode registrar uma justificativa opcional. Depois clique em Salvar frequência.",
      },
      {
        target: "[data-tour=\"pt-tab-duvidas\"]",
        title: "Dúvidas no fórum",
        content: "Veja perguntas dos alunos sobre as aulas do curso e responda como professor. Suas respostas aparecem na área do aluno e contam na gamificação.",
      },
      {
        target: null,
        title: "Tudo pronto!",
        content:
          "Use esta página para acompanhar sua turma: alunos, exercícios, progresso, frequência e dúvidas. Bom trabalho!",
      },
    ];
  }, [classGroup]);

  if (loading && !classGroup) {
    return (
      <div className="flex min-w-0 justify-center py-12">
        <p className="text-[var(--text-muted)]">Carregando...</p>
      </div>
    );
  }
  if (!classGroup) {
    return (
      <div className="flex min-w-0 flex-col gap-4 py-8">
        <p className="text-[var(--text-muted)]">Turma não encontrada.</p>
        <Link href="/professor/turmas" className="text-[var(--igh-primary)] hover:underline">
          ← Voltar às turmas
        </Link>
      </div>
    );
  }

  // Sessão "com aula liberada" = tem lessonId (API expõe como canTakeAttendance)
  const sessionsWithLesson = sessions.filter((s) => s.canTakeAttendance);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardTutorial
        showForStudent={user.role !== "MASTER"}
        steps={tutorialSteps}
        storageKey="teacher-turmas-detail-tutorial-done"
      />
      <header className="flex flex-wrap items-start justify-between gap-4" data-tour="pt-header">
        <div>
          <Link href="/professor/turmas" className="text-sm text-[var(--igh-primary)] hover:underline" data-tour="pt-voltar">
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
        <Link
          href={`/professor/turmas/${id}/apresentar`}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--igh-primary)]/40 bg-[var(--igh-primary)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--igh-primary)] hover:bg-[var(--igh-primary)]/15"
          data-tour="pt-apresentar"
        >
          <Presentation className="h-4 w-4 shrink-0" aria-hidden />
          Modo apresentação
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-[var(--card-border)] pb-2" data-tour="pt-tabs">
        <button
          type="button"
          onClick={() => setTab("alunos")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "alunos"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
          }`}
          data-tour="pt-tab-alunos"
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
          data-tour="pt-tab-exercicios"
        >
          Exercícios realizados
        </button>
        <button
          type="button"
          onClick={() => setTab("aulas")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "aulas"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
          }`}
          data-tour="pt-tab-aulas"
        >
          Aulas assistidas
        </button>
        <button
          type="button"
          onClick={() => setTab("frequencia")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "frequencia"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
          }`}
          data-tour="pt-tab-frequencia"
        >
          Frequência
        </button>
        <button
          type="button"
          onClick={() => setTab("duvidas")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "duvidas"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
          }`}
          data-tour="pt-tab-duvidas"
        >
          Dúvidas (fórum)
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
                      {e.studentBirthDate && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Nasc.: {formatDate(e.studentBirthDate)}
                        </p>
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
          <p className="px-4 py-2 text-xs text-[var(--text-muted)]">
            Todas as tentativas são registradas (erros e acertos). Ordem cronológica: primeira tentativa primeiro.
          </p>
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
                  {row.answers.length > 0 && (() => {
                    const byLesson = new Map<string, typeof row.answers>();
                    for (const a of row.answers) {
                      if (!byLesson.has(a.lessonId)) byLesson.set(a.lessonId, []);
                      byLesson.get(a.lessonId)!.push(a);
                    }
                    return (
                      <ul className="mt-2 space-y-4 pl-4 text-sm">
                        {Array.from(byLesson.entries()).map(([lid, lessonAnswers]) => {
                          const lessonTitle = lessonAnswers[0].lessonTitle;
                          const byExercise = new Map<string, typeof row.answers>();
                          for (const a of lessonAnswers) {
                            if (!byExercise.has(a.exerciseId)) byExercise.set(a.exerciseId, []);
                            byExercise.get(a.exerciseId)!.push(a);
                          }
                          return (
                            <li key={lid} className="flex flex-col gap-2">
                              <p className="font-semibold text-[var(--text-primary)]">{lessonTitle}</p>
                              <ul className="space-y-2 pl-3 border-l-2 border-[var(--card-border)]">
                                {Array.from(byExercise.entries()).map(([exerciseId, attempts]) => {
                                  const first = attempts[0];
                                  return (
                                    <li key={exerciseId} className="flex flex-col gap-0.5">
                                      <p className="font-medium text-[var(--text-secondary)]">{first.question}</p>
                                      <ul className="space-y-1 pl-2 text-[var(--text-secondary)]">
                                        {attempts.map((a) => (
                                          <li key={a.id}>
                                            <span className={a.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                              {a.correct ? "Acerto" : "Erro"}
                                            </span>
                                            <span className="ml-1.5 text-[var(--text-muted)]">
                                              {formatDateTime(a.createdAt)}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "aulas" && (
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
          <h2 className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Aulas assistidas e concluídas
          </h2>
          <p className="px-4 py-2 text-xs text-[var(--text-muted)]">
            Progresso de cada aluno nas aulas do curso (último acesso e conclusão).
          </p>
          {lessonProgressByEnrollment.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">
              Nenhum aluno com progresso registrado ainda.
            </p>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {lessonProgressByEnrollment.map((row) => {
                const completedCount = row.progress.filter((p) => p.completed).length;
                return (
                  <div key={row.enrollmentId} className="p-4">
                    <p className="font-medium text-[var(--text-primary)]">{row.studentName}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {completedCount} de {row.progress.length} aulas concluídas
                    </p>
                    {row.progress.length > 0 && (
                      <ul className="mt-2 space-y-3 pl-4 text-sm text-[var(--text-secondary)]">
                        {row.progress.map((p) => (
                          <li key={p.lessonId} className="flex flex-col gap-0.5">
                            <span>
                              <span className="font-medium text-[var(--text-primary)]">{p.lessonTitle}</span>
                              {" · "}
                              <span className={p.completed ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                                {p.completed ? "Concluída" : "Em andamento"}
                              </span>
                            </span>
                            <div className="flex flex-col gap-0.5 pl-2 text-[var(--text-muted)]">
                              <span>Último acesso: {p.lastAccessedAt ? formatDateTime(p.lastAccessedAt) : "—"}</span>
                              {p.completed && p.completedAt && (
                                <span>Concluída em: {formatDateTime(p.completedAt)}</span>
                              )}
                              <span>Tempo total: {formatMinutes(p.totalMinutesStudied)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "duvidas" && (
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
          <h2 className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Dúvidas dos alunos (fórum por aula)
          </h2>
          <p className="px-4 py-2 text-xs text-[var(--text-muted)]">
            Respostas publicadas aqui aparecem para os alunos na área da aula e contam pontos na gamificação do professor.
          </p>
          {loadingDuvidas ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Carregando...</p>
          ) : lessonQuestions.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Nenhuma dúvida registrada ainda neste curso.</p>
          ) : (
            <ul className="divide-y divide-[var(--card-border)]">
              {lessonQuestions.map((q) => (
                <li key={q.id} className="p-4">
                  <p className="text-xs font-medium text-[var(--igh-primary)]">
                    {q.moduleTitle ? `${q.moduleTitle} · ` : ""}
                    {q.lessonTitle}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {q.authorName} · {formatDateTime(q.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{q.content}</p>
                  {q.teacherReplies.length > 0 && (
                    <div className="mt-3 rounded-md border border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5 p-2">
                      <p className="text-xs font-semibold text-[var(--igh-primary)]">Suas respostas</p>
                      {q.teacherReplies.map((r) => (
                        <div key={r.id} className="mt-2 text-xs">
                          <span className="font-medium text-[var(--text-primary)]">{r.teacherName}</span>
                          <span className="ml-2 text-[var(--text-muted)]">{formatDateTime(r.createdAt)}</span>
                          <p className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <textarea
                      value={replyDrafts[q.id] ?? ""}
                      onChange={(e) => setReplyDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      rows={3}
                      placeholder="Responder como professor..."
                      className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <Button
                      type="button"
                      className="mt-2"
                      onClick={() => void handleSendTeacherReply(q.id)}
                      disabled={savingReplyQuestionId === q.id}
                    >
                      {savingReplyQuestionId === q.id ? "Enviando..." : "Publicar resposta"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "frequencia" && (
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
          <h2 className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Frequência (aulas liberadas)
          </h2>
          <p className="px-4 py-2 text-xs text-[var(--text-muted)]">
            Selecione uma sessão com aula liberada para marcar presença (alunos em ordem alfabética). Se a sessão de hoje não aparecer, a aula ainda não foi liberada para ela.
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
              <ul className="space-y-3">
                {attendanceSorted.map((row) => (
                  <li
                    key={row.enrollmentId}
                    className="rounded-lg border border-[var(--card-border)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{row.studentName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePresent(row.enrollmentId)}
                        className={`shrink-0 rounded px-3 py-1 text-sm font-medium ${
                          row.present
                            ? "bg-green-600 text-white"
                            : "bg-[var(--igh-surface)] text-[var(--text-muted)]"
                        }`}
                      >
                        {row.present ? "Presente" : "Ausente"}
                      </button>
                    </div>
                    {!row.present && (
                      <div className="mt-2 border-t border-[var(--card-border)] pt-2">
                        <label
                          htmlFor={`absence-${row.enrollmentId}`}
                          className="text-xs font-medium text-[var(--text-muted)]"
                        >
                          Justificativa da ausência (opcional)
                        </label>
                        <textarea
                          id={`absence-${row.enrollmentId}`}
                          value={row.absenceJustification ?? ""}
                          onChange={(e) =>
                            handleAbsenceJustificationChange(row.enrollmentId, e.target.value)
                          }
                          rows={2}
                          maxLength={2000}
                          placeholder="Ex.: faltou por motivo de saúde, trabalho…"
                          className="mt-1 w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                      </div>
                    )}
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
