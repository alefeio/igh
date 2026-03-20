"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { TeacherLessonForumPanel } from "@/components/forum/TeacherLessonForumPanel";
import type { ApiResponse } from "@/lib/api-types";

type TopicsMeta = { lessonTitle: string; moduleTitle: string };

export default function TeacherForumLessonPage() {
  const params = useParams();
  const courseId = typeof params.courseId === "string" ? params.courseId : "";
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";
  const [meta, setMeta] = useState<TopicsMeta | null>(null);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/teacher/course-forum/${courseId}/lessons/${lessonId}/topics`);
        const json = (await res.json()) as ApiResponse<TopicsMeta & { topics: unknown[] }>;
        if (!cancelled && res.ok && json?.ok) {
          setMeta({ lessonTitle: json.data.lessonTitle, moduleTitle: json.data.moduleTitle });
        }
      } catch {
        /* opcional */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  return (
    <div className="min-w-0">
      <DashboardHero
        eyebrow={meta?.moduleTitle ?? "Aula"}
        title={meta?.lessonTitle ?? "Fórum da aula"}
        description="Leia os tópicos dos alunos e publique respostas visíveis para todo o curso."
      />

      <div className="mt-6">
        {courseId && lessonId ? (
          <TeacherLessonForumPanel courseId={courseId} lessonId={lessonId} />
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Parâmetros inválidos.</p>
        )}
      </div>

      <p className="mt-8 flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
        <Link href={`/professor/forum/${courseId}`} className="font-medium text-[var(--igh-primary)] hover:underline">
          ← Aulas do curso
        </Link>
        <Link href="/professor/forum" className="font-medium text-[var(--igh-primary)] hover:underline">
          Todos os cursos
        </Link>
      </p>
    </div>
  );
}
