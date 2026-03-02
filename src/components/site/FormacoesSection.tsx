"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/site";
import { Modal } from "@/components/ui/Modal";
import type { CourseForSite } from "@/lib/site-data";
import type { FormationFilterItem } from "@/lib/site-data";

type Props = {
  formations: FormationFilterItem[];
  courses: CourseForSite[];
  formacaoSlug: string | undefined;
  courseDetail: CourseForSite | null;
  /** Base path for filter and course links (e.g. "/formacoes" or "/") */
  basePath?: string;
};

export function FormacoesSection({
  formations,
  courses,
  formacaoSlug,
  courseDetail,
  basePath = "/formacoes",
}: Props) {
  const router = useRouter();

  const closeModal = () => {
    const params = new URLSearchParams();
    if (formacaoSlug) params.set("formacao", formacaoSlug);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--igh-secondary)]">Filtrar:</span>
        <Link
          href={basePath}
          scroll={false}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            !formacaoSlug
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--igh-surface)] text-[var(--igh-secondary)] hover:bg-[var(--igh-border)]"
          }`}
        >
          Todas
        </Link>
        {formations.map((f) => (
          <Link
            key={f.id}
            href={`${basePath}?formacao=${encodeURIComponent(f.slug)}`}
            scroll={false}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              formacaoSlug === f.slug
                ? "bg-[var(--igh-primary)] text-white"
                : "bg-[var(--igh-surface)] text-[var(--igh-secondary)] hover:bg-[var(--igh-border)]"
            }`}
          >
            {f.title}
          </Link>
        ))}
      </div>

      {courses.length === 0 ? (
        <p className="text-center text-[var(--igh-muted)]">
          {formacaoSlug ? "Nenhum curso nesta formação no momento." : "Nenhum curso cadastrado no momento."}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const params = new URLSearchParams();
            if (formacaoSlug) params.set("formacao", formacaoSlug);
            params.set("curso", c.slug);
            const href = `${basePath}?${params.toString()}`;
            return (
              <Link key={c.id} href={href} scroll={false} className="block">
                <Card as="article" className="flex h-full flex-col transition-shadow hover:shadow-md">
                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="mb-3 h-32 w-full rounded-lg object-cover"
                    />
                  )}
                  <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">{c.name}</h3>
                  {c.formationTitle && (
                    <p className="mt-1 text-xs font-medium text-[var(--igh-primary)]">{c.formationTitle}</p>
                  )}
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--igh-muted)]">
                    {c.description ?? "Sem descrição."}
                  </p>
                  {c.workloadHours != null && (
                    <p className="mt-2 text-xs text-[var(--igh-muted)]">{c.workloadHours}h</p>
                  )}
                  <span className="mt-4 inline-flex w-full justify-center rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white">
                    Ver detalhes
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={!!courseDetail} title={courseDetail?.name ?? ""} onClose={closeModal}>
        {courseDetail && (
          <div className="flex flex-col gap-4">
            {courseDetail.imageUrl && (
              <img
                src={courseDetail.imageUrl}
                alt=""
                className="h-40 w-full rounded-lg object-cover"
              />
            )}
            {courseDetail.description && (
              <p className="text-sm text-[var(--igh-muted)]">{courseDetail.description}</p>
            )}
            {courseDetail.workloadHours != null && (
              <p className="text-sm font-medium text-[var(--igh-secondary)]">
                Carga horária: {courseDetail.workloadHours}h
              </p>
            )}
            {courseDetail.content && (
              <div
                className="prose prose-sm max-w-none text-[var(--igh-muted)]"
                dangerouslySetInnerHTML={{ __html: courseDetail.content }}
              />
            )}
            <Button as="link" href="/contato#inscreva" variant="primary" size="sm" className="w-full">
              Inscreva-se
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
