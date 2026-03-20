"use client";

import { Lock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";

type LessonRow = {
  lessonId: string;
  title: string;
  moduleTitle: string;
  moduleOrder: number;
  lessonOrder: number;
  topicCount: number;
  lastActivity: string | null;
  isLiberada: boolean;
};

export default function StudentForumCourseLessonsPage() {
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
        const res = await fetch(`/api/me/course-forum/${courseId}/lessons`);
        const json = (await res.json()) as ApiResponse<{ courseName: string; lessons: LessonRow[] }>;
        if (res.ok && json?.ok) {
          setCourseName(json.data.courseName);
          setLessons(json.data.lessons);
        } else {
          toast.push("error", json && "error" in json ? json.error.message : "Não foi possível carregar as aulas.");
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
        description="Abra o fórum de cada aula. Aulas ainda não liberadas no cronograma aparecem com cadeado — você pode ler, e publicar quando forem liberadas."
      />

      <section className="mt-6" aria-label="Lista de aulas">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando aulas…</p>
        ) : (
          <ul className="space-y-2">
            {lessons.map((l) => (
              <li key={l.lessonId}>
                <Link
                  href={`/minhas-turmas/forum/${courseId}/aula/${l.lessonId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm transition hover:border-[var(--igh-primary)]/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{l.title}</span>
                      {!l.isLiberada && (
                        <Badge tone="amber">
                          <span className="inline-flex items-center gap-1 text-[10px]">
                            <Lock className="h-3 w-3" aria-hidden />
                            Leitura
                          </span>
                        </Badge>
                      )}
                    </div>
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
        <Link href="/minhas-turmas/forum" className="font-medium text-[var(--igh-primary)] hover:underline">
          ← Todos os cursos
        </Link>
      </p>
    </div>
  );
}
