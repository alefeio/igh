"use client";

import { BookOpen, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type CourseRow = {
  courseId: string;
  courseName: string;
  topicCount: number;
  classGroupsCount: number;
};

export default function AdminForumHubPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/course-forum/courses");
        const json = (await res.json()) as ApiResponse<{ courses: CourseRow[] }>;
        if (res.ok && json?.ok) setCourses(json.data.courses);
        else toast.push("error", json && "error" in json ? json.error.message : "Não foi possível carregar.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [toast]);

  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow="Administração"
        title="Fóruns — todos os cursos"
        description={
          <>
            Visão global das discussões por <strong>aula</strong> em cada curso ativo — alunos de <strong>todas as turmas</strong>{" "}
            do curso no mesmo fórum. Útil para integração entre cursos e acompanhamento do projeto integrador.
          </>
        }
      />

      <SectionCard
        title="Comunidade e integração"
        description="Acompanhe onde há movimento entre disciplinas e incentive conexões com o fechamento do curso."
        variant="elevated"
        className="mt-6"
      >
        <p className="text-sm text-[var(--text-secondary)]">
          O painel principal também mostra uma faixa com os fóruns mais ativos em toda a plataforma. Use esta página para entrar
          em qualquer curso e navegar por aula.
        </p>
      </SectionCard>

      <section className="mt-8" aria-labelledby="admin-forum-cursos">
        <h2 id="admin-forum-cursos" className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
          <BookOpen className="h-5 w-5 text-[var(--igh-primary)]" aria-hidden />
          Cursos ativos
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum curso ativo cadastrado.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.courseId}>
                <Link
                  href={`/admin/forum/${c.courseId}`}
                  className="flex flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)]"
                >
                  <span className="font-semibold text-[var(--text-primary)]">{c.courseName}</span>
                  <span className="mt-1 text-xs text-[var(--text-muted)]">
                    {c.classGroupsCount} {c.classGroupsCount === 1 ? "turma" : "turmas"} · {c.topicCount}{" "}
                    {c.topicCount === 1 ? "tópico" : "tópicos"}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--igh-primary)]">
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Abrir fórum por aula
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard" className="font-medium text-[var(--igh-primary)] hover:underline">
          ← Voltar ao dashboard
        </Link>
      </p>
    </div>
  );
}
