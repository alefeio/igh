import { ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";

import type { DashboardForumLessonActivity } from "@/lib/dashboard-forum-activity";

function formatActivityShort(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Faixa horizontal de aulas cujo fórum já tem pelo menos um tópico (qualquer pessoa do curso).
 */
export function DashboardForumActivityRail({
  items,
  variant,
}: {
  items: DashboardForumLessonActivity[];
  variant: "student" | "teacher";
}) {
  if (items.length === 0) return null;

  const hubHref = variant === "student" ? "/minhas-turmas/forum" : "/professor/forum";
  const lessonHref = (courseId: string, lessonId: string) =>
    variant === "student"
      ? `/minhas-turmas/forum/${courseId}/aula/${lessonId}`
      : `/professor/forum/${courseId}/aula/${lessonId}`;

  return (
    <section
      className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-6"
      aria-labelledby="dashboard-forum-rail-heading"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="dashboard-forum-rail-heading"
            className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
          >
            <MessageCircle className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            Fóruns com movimento
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Aulas em que já existe discussão no fórum do curso (qualquer aluno ou professor). Você pode entrar para acompanhar
            ou participar, mesmo sem ter comentado antes.
          </p>
        </div>
        <Link
          href={hubHref}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
        >
          Ver todos os cursos
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="relative -mx-1">
        <ul
          className="flex gap-3 overflow-x-auto scroll-smooth pb-1 pt-1 [scrollbar-width:thin]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item) => (
            <li key={item.lessonId} className="min-w-[min(100%,260px)] max-w-[280px] shrink-0 snap-start sm:min-w-[240px]">
              <Link
                href={lessonHref(item.courseId, item.lessonId)}
                className="flex h-full flex-col rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-4 transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] line-clamp-1">
                  {item.courseName}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
                  {item.lessonTitle}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">{item.moduleTitle}</p>
                <p className="mt-3 text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--igh-primary)]">{item.topicCount}</span>
                  {item.topicCount === 1 ? " tópico" : " tópicos"}
                  <span className="mx-1.5 text-[var(--text-muted)]">·</span>
                  <span title="Última atualização em um tópico desta aula">{formatActivityShort(item.lastActivityAt)}</span>
                </p>
                <span className="mt-auto pt-3 text-xs font-bold text-[var(--igh-primary)]">Abrir fórum →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
