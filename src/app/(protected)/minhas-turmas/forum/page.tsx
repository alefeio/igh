"use client";

import { MessageCircle, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type CourseRow = {
  courseId: string;
  courseName: string;
  primaryEnrollmentId: string;
  topicCount: number;
  enrollmentCount: number;
};

export default function StudentForumHubPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/me/course-forum/courses");
        const json = (await res.json()) as ApiResponse<{ courses: CourseRow[] }>;
        if (res.ok && json?.ok) setCourses(json.data.courses);
        else toast.push("error", json && "error" in json ? json.error.message : "Não foi possível carregar os cursos.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [toast]);

  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow="Comunidade"
        title="Fórum dos cursos"
        description={
          <>
            Converse com <strong>toda a turma do curso</strong>, independente de qual turma você está. Troque experiências, tire
            dúvidas e incentive quem estuda com você — o professor também participa.
          </>
        }
      />

      <SectionCard
        title="Por que participar?"
        description="Quanto mais gente no fórum, mais rápido todo mundo aprende."
        variant="elevated"
        className="mt-6"
      >
        <ul className="grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
          <li className="flex gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
            <Users className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            <span>
              <strong className="text-[var(--text-primary)]">Visão do curso</strong> — mensagens de alunos de todas as turmas do
              mesmo curso.
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            <span>
              <strong className="text-[var(--text-primary)]">Um tópico por aula</strong> — organizado para combinar com o que você
              está estudando.
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
            <Sparkles className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            <span>
              <strong className="text-[var(--text-primary)]">Reconhecimento</strong> — responda colegas e ganhe pontos na
              gamificação.
            </span>
          </li>
        </ul>
      </SectionCard>

      <section className="mt-8" aria-labelledby="forum-cursos-heading">
        <h2 id="forum-cursos-heading" className="mb-4 text-lg font-bold text-[var(--text-primary)]">
          Escolha o curso
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Você não está matriculado em nenhum curso ativo.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.courseId}>
                <Link
                  href={`/minhas-turmas/forum/${c.courseId}`}
                  className="flex flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)]"
                >
                  <span className="font-semibold text-[var(--text-primary)]">{c.courseName}</span>
                  <span className="mt-1 text-xs text-[var(--text-muted)]">
                    {c.topicCount} {c.topicCount === 1 ? "tópico" : "tópicos"} no fórum
                    {c.enrollmentCount > 1 ? ` · ${c.enrollmentCount} matrículas neste curso` : ""}
                  </span>
                  <span className="mt-3 text-sm font-medium text-[var(--igh-primary)]">Ver aulas do fórum →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-[var(--text-muted)]">
        <Link href="/minhas-turmas" className="font-medium text-[var(--igh-primary)] hover:underline">
          ← Voltar para minhas turmas
        </Link>
      </p>
    </div>
  );
}
