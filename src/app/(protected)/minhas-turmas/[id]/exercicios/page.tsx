\"use client\";

import Link from \"next/link\";
import { useParams } from \"next/navigation\";
import { useEffect, useState } from \"react\";

import { ClipboardList, AlertCircle, CheckCircle2 } from \"lucide-react\";

import { useToast } from \"@/components/feedback/ToastProvider\";
import type { ApiResponse } from \"@/lib/api-types\";

type LessonStat = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  moduleOrder: number;
  totalAttempts: number;
  correctAttempts: number;
};

type CourseExercisesResponse = {
  courseName: string;
  exerciseStats?: {
    totalCorrect: number;
    totalAttempts: number;
    lessonStats: LessonStat[];
  };
};

export default function EnrollmentExercisesSummaryPage() {
  const params = useParams();
  const enrollmentId = params?.id as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CourseExercisesResponse | null>(null);

  useEffect(() => {
    if (!enrollmentId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/course-content`);
        const json = (await res.json()) as ApiResponse<CourseExercisesResponse>;
        if (res.ok && json?.ok) {
          setData(json.data);
        } else {
          toast.push(
            \"error\",
            json && \"error\" in json ? json.error.message : \"Não foi possível carregar os exercícios.\"
          );
          setData(null);
        }
      } catch {
        toast.push(\"error\", \"Não foi possível carregar os exercícios.\");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [enrollmentId, toast]);

  if (!enrollmentId) {
    return (
      <div className=\"container-page flex flex-col gap-6\">
        <div className=\"card\">
          <div className=\"card-body py-10 text-center text-[var(--text-muted)]\">
            Matrícula não encontrada.
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className=\"container-page flex flex-col gap-6\">
        <Link
          href={`/minhas-turmas/${enrollmentId}/conteudo`}
          className=\"text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded\"
        >
          ← Voltar ao conteúdo do curso
        </Link>
        <div className=\"card\">
          <div className=\"card-body py-10 text-center text-[var(--text-secondary)]\">
            {loading ? \"Carregando respostas dos exercícios...\" : \"Dados não encontrados.\"}
          </div>
        </div>
      </div>
    );
  }

  const stats = data.exerciseStats;
  const lessonStats = stats?.lessonStats ?? [];

  const hasAttempts = (stats?.totalAttempts ?? 0) > 0 && lessonStats.length > 0;

  return (
    <div className=\"container-page flex flex-col gap-6\">
      <header className=\"flex flex-col gap-2\">
        <Link
          href={`/minhas-turmas/${enrollmentId}/conteudo`}
          className=\"text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded\"
        >
          ← Voltar ao conteúdo do curso
        </Link>
        <div>
          <h1 className=\"text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl\">
            Exercícios por aula
          </h1>
          <p className=\"mt-1 text-sm text-[var(--text-muted)]\">
            Veja, para cada aula, quantos exercícios você acertou e quantos errou.
          </p>
        </div>
      </header>

      <section className=\"card\" aria-labelledby=\"exercises-summary-heading\">
        <div className=\"card-header flex items-center gap-3\">
          <div className=\"flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--igh-primary)]/10 text-[var(--igh-primary)]\">
            <ClipboardList className=\"h-5 w-5\" aria-hidden />
          </div>
          <div>
            <h2
              id=\"exercises-summary-heading\"
              className=\"text-base font-semibold text-[var(--text-primary)]\"
            >
              Resumo dos exercícios
            </h2>
            <p className=\"mt-0.5 text-sm text-[var(--text-muted)]\">
              Curso: {data.courseName}
            </p>
          </div>
        </div>
        <div className=\"card-body\">
          {!hasAttempts ? (
            <p className=\"text-sm text-[var(--text-muted)]\">
              Você ainda não respondeu exercícios neste curso. Responda às questões ao final das aulas
              para ver aqui seus acertos e erros por aula.
            </p>
          ) : (
            <div className=\"space-y-4\">
              {lessonStats
                .slice()
                .sort(
                  (a, b) =>
                    a.moduleOrder - b.moduleOrder ||
                    a.lessonTitle.localeCompare(b.lessonTitle, \"pt-BR\")
                )
                .map((lesson, index) => {
                  const errors = Math.max(
                    0,
                    lesson.totalAttempts - lesson.correctAttempts
                  );
                  const hasErrors = errors > 0;
                  return (
                    <div
                      key={lesson.lessonId}
                      className=\"rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4\"
                    >
                      <div className=\"flex flex-wrap items-center justify-between gap-2\">
                        <div className=\"min-w-0 flex-1\">
                          <p className=\"text-sm font-semibold text-[var(--text-primary)]\">
                            Aula {index + 1}
                          </p>
                          <p className=\"mt-0.5 text-sm text-[var(--text-secondary)] line-clamp-2\">
                            {lesson.lessonTitle}
                          </p>
                        </div>
                        <div className=\"text-right text-sm text-[var(--text-secondary)]\">
                          <div>
                            <span className=\"font-medium text-green-700 dark:text-green-400\">
                              Acertos: {lesson.correctAttempts}
                            </span>
                          </div>
                          <div>
                            <span className=\"font-medium text-red-700 dark:text-red-400\">
                              Erros: {errors}
                            </span>
                          </div>
                        </div>
                      </div>
                      {hasErrors ? (
                        <div className=\"mt-3 flex flex-wrap items-center justify-between gap-2\">
                          <p className=\"flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400\">
                            <AlertCircle className=\"h-3.5 w-3.5\" aria-hidden />
                            Há questões desta aula que precisam de revisão.
                          </p>
                          <Link
                            href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${lesson.lessonId}?secao=exercicios#secoes`}
                            className=\"text-xs font-medium text-[var(--igh-primary)] underline hover:no-underline\"
                          >
                            Ir para exercícios desta aula
                          </Link>
                        </div>
                      ) : (
                        <p className=\"mt-3 flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400\">
                          <CheckCircle2 className=\"h-3.5 w-3.5\" aria-hidden />
                          Nenhum erro nas tentativas desta aula.
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

