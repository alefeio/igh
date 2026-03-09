"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Lesson = {
  id: string;
  title: string;
  order: number;
  videoUrl: string | null;
  contentRich: string | null;
  imageUrls: string[];
  isLiberada: boolean;
  completed: boolean;
};

type Module = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
};

export default function ConteudoPage() {
  const params = useParams();
  const enrollmentId = params?.id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ courseName: string; modules: Module[] } | null>(null);

  useEffect(() => {
    if (!enrollmentId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/course-content`);
        const json = (await res.json()) as ApiResponse<{ courseName: string; modules: Module[] }>;
        if (res.ok && json?.ok) setData(json.data);
        else toast.push("error", json && "error" in json ? json.error.message : "Conteúdo não disponível ou ainda não liberado.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [enrollmentId, toast]);

  if (loading || !data) {
    return (
      <div className="container-page flex flex-col gap-6">
        <Link
          className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
          href={`/minhas-turmas/${enrollmentId}`}
        >
          ← Voltar à turma
        </Link>
        <div className="card">
          <div className="card-body py-10 text-center text-[var(--text-secondary)]">
            {loading ? "Carregando conteúdo do curso..." : "Conteúdo não encontrado."}
          </div>
        </div>
      </div>
    );
  }

  const totalLessons = data.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedCount = data.modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.completed).length,
    0
  );

  const moduleInProgress = (() => {
    for (const mod of data.modules) {
      const hasIncomplete = mod.lessons.some((l) => l.isLiberada && !l.completed);
      if (hasIncomplete) return mod;
    }
    return null;
  })();
  const allCompleted = totalLessons > 0 && completedCount === totalLessons;

  return (
    <div className="container-page flex flex-col gap-6">
      <nav aria-label="Navegação">
        <Link
          className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
          href={`/minhas-turmas/${enrollmentId}`}
        >
          ← Voltar à turma
        </Link>
      </nav>

      {totalLessons > 0 && (
        <section
          className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3"
          aria-labelledby="progress-heading"
        >
          <h2 id="progress-heading" className="sr-only">
            Trilha de progresso
          </h2>
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <BookOpen className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            <span className="text-sm font-medium">
              {completedCount} de {totalLessons} {totalLessons === 1 ? "aula concluída" : "aulas concluídas"}
            </span>
          </div>
          {allCompleted ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              Curso concluído
            </span>
          ) : moduleInProgress ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Módulo {moduleInProgress.order + 1} em andamento
            </span>
          ) : null}
        </section>
      )}

      <div className="card">
        <header className="card-header">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            {data.courseName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {totalLessons === 0
              ? "Módulos e aulas do curso"
              : `${totalLessons} ${totalLessons === 1 ? "aula" : "aulas"}${completedCount > 0 ? ` · ${completedCount} concluída${completedCount > 1 ? "s" : ""}` : ""}`}
          </p>
        </header>
        <div className="card-body space-y-8">
          {data.modules.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-10 text-center"
              role="status"
            >
              <p className="text-sm text-[var(--text-muted)]">
                Nenhum módulo cadastrado para este curso ainda.
              </p>
            </div>
          ) : (
            data.modules.map((mod) => (
              <section
                key={mod.id}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 sm:p-5"
                aria-labelledby={`module-${mod.id}`}
              >
                <h2 id={`module-${mod.id}`} className="text-base font-semibold text-[var(--text-primary)]">
                  {mod.title}
                </h2>
                {mod.description && (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                    {mod.description}
                  </p>
                )}
                <ul className="mt-4 list-none space-y-0 p-0" aria-label={`Aulas do módulo ${mod.title}`}>
                  {mod.lessons.map((lesson, index) => (
                    <li
                      key={lesson.id}
                      className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                        index < mod.lessons.length - 1
                          ? "border-b border-[var(--card-border)]"
                          : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 font-medium text-[var(--text-primary)]">
                        {lesson.title}
                        {lesson.completed && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            Concluída
                          </span>
                        )}
                      </span>
                      {lesson.isLiberada ? (
                        <Link
                          href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${lesson.id}`}
                          className="shrink-0 rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                        >
                          Abrir conteúdo
                        </Link>
                      ) : (
                        <span
                          className="shrink-0 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
                          aria-label="Aula ainda não liberada"
                        >
                          Em breve
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
