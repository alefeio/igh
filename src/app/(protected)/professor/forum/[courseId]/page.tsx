"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type LessonRow = {
  lessonId: string;
  title: string;
  moduleTitle: string;
  topicCount: number;
  lastActivity: string | null;
};

export default function TeacherForumCourseLessonsPage() {
  const params = useParams();
  const courseId = typeof params.courseId === "string" ? params.courseId : "";
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [lessons, setLessons] = useState<LessonRow[]>([]);

  useEffect(() => {
    if (!courseId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/teacher/course-forum/${courseId}/lessons`);
        const json = (await res.json()) as ApiResponse<{ courseName: string; lessons: LessonRow[] }>;
        if (res.ok && json?.ok) {
          setCourseName(json.data.courseName);
          setLessons(json.data.lessons);
        } else {
          toast.push("error", json && "error" in json ? json.error.message : "Não foi possível carregar.");
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [courseId, toast]);

  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow="Fórum do curso"
        title={courseName || "Carregando…"}
        description="Escolha a aula para ver tópicos de todos os alunos matriculados em qualquer turma deste curso."
      />

      <section className="mt-6" aria-label="Aulas">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <ul className="space-y-2">
            {lessons.map((l) => (
              <li key={l.lessonId}>
                <Link
                  href={`/professor/forum/${courseId}/aula/${l.lessonId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm transition hover:border-[var(--igh-primary)]/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-[var(--text-primary)]">{l.title}</span>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{l.moduleTitle}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <MessageCircle className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
                    <span>{l.topicCount}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-[var(--text-muted)]">
        <Link href="/professor/forum" className="font-medium text-[var(--igh-primary)] hover:underline">
          ← Todos os cursos
        </Link>
      </p>
    </div>
  );
}
