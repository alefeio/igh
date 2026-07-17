"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/site/Badge";
import { Card } from "@/components/site/Card";
import type { CourseForSite } from "@/lib/site-data";
import type { FormationFilterItem } from "@/lib/site-data";

export type ObjectiveId = "iniciar" | "atualizar" | "recolocar" | "continuar";

const OBJECTIVE_LABELS: Record<ObjectiveId, string> = {
  iniciar: "Quero começar",
  atualizar: "Quero me atualizar",
  recolocar: "Quero me recolocar",
  continuar: "Formação contínua",
};

/** Palavras-chave por objetivo (filtro client-side no catálogo amplo). */
const OBJECTIVE_KEYWORDS: Record<ObjectiveId, string[]> = {
  iniciar: ["básico", "basico", "iniciante", "introdução", "introducao", "fundamentos", "informática", "informatica", "primeiros"],
  atualizar: ["avançado", "avancado", "intermediário", "intermediario", "atualização", "atualizacao", "especialização", "especializacao"],
  recolocar: ["carreira", "mercado", "emprego", "portfólio", "portfolio", "profissional", "trabalho"],
  continuar: ["trilha", "formação", "formacao", "módulo", "modulo", "projeto", "integrador"],
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesObjective(course: CourseForSite, objetivo: ObjectiveId): boolean {
  const hay = normalize(
    [course.name, course.description ?? "", course.formationTitle ?? ""].join(" ")
  );
  return OBJECTIVE_KEYWORDS[objetivo].some((kw) => hay.includes(normalize(kw)));
}

function matchesQuery(course: CourseForSite, q: string): boolean {
  const nq = normalize(q);
  if (!nq) return true;
  const hay = normalize(
    [course.name, course.description ?? "", course.formationTitle ?? ""].join(" ")
  );
  return nq.split(/\s+/).filter(Boolean).every((token) => hay.includes(token));
}

type Props = {
  formations: FormationFilterItem[];
  courses: CourseForSite[];
  formacaoSlug: string | undefined;
  /** Busca inicial (URL ?q=). */
  initialQuery?: string;
  /** Objetivo inicial (URL ?objetivo=). */
  initialObjetivo?: string;
  /** Base path for filter links (e.g. "/formacoes" or "/"). Course links always go to /cursos/[slug]. */
  basePath?: string;
};

function isObjectiveId(v: string | undefined): v is ObjectiveId {
  return v === "iniciar" || v === "atualizar" || v === "recolocar" || v === "continuar";
}

export function FormacoesSection({
  formations,
  courses,
  formacaoSlug,
  initialQuery = "",
  initialObjetivo,
  basePath = "/formacoes",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const objetivo = isObjectiveId(initialObjetivo) ? initialObjetivo : undefined;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const buildHref = useCallback(
    (opts: { formacao?: string | null; q?: string; objetivo?: string | null }) => {
      const params = new URLSearchParams();
      const formacao = opts.formacao === undefined ? formacaoSlug : opts.formacao;
      const q = opts.q === undefined ? query : opts.q;
      const obj = opts.objetivo === undefined ? objetivo : opts.objetivo;
      if (formacao) params.set("formacao", formacao);
      if (q.trim()) params.set("q", q.trim());
      if (obj) params.set("objetivo", obj);
      const qs = params.toString();
      const hash = basePath === "/" ? "#catalogo" : "";
      return qs ? `${basePath}?${qs}${hash}` : `${basePath}${hash}`;
    },
    [basePath, formacaoSlug, query, objetivo]
  );

  const pushFilters = useCallback(
    (opts: { formacao?: string | null; q?: string; objetivo?: string | null }) => {
      startTransition(() => {
        router.push(buildHref(opts), { scroll: basePath === "/" ? false : true });
      });
    },
    [basePath, buildHref, router]
  );

  const filtered = useMemo(() => {
    const byFormacaoAndQuery = (c: CourseForSite) => {
      if (formacaoSlug && c.formationSlug !== formacaoSlug) return false;
      if (!matchesQuery(c, query)) return false;
      return true;
    };

    const withObjective = courses.filter((c) => {
      if (!byFormacaoAndQuery(c)) return false;
      if (objetivo && !matchesObjective(c, objetivo)) return false;
      return true;
    });

    // Se o objetivo não casar com nenhum nome/descrição, mantém o catálogo filtrado só por formação/busca.
    if (objetivo && withObjective.length === 0) {
      return courses.filter(byFormacaoAndQuery);
    }
    return withObjective;
  }, [courses, formacaoSlug, objetivo, query]);

  const objectiveSoftFallback =
    !!objetivo &&
    filtered.length > 0 &&
    !courses.some(
      (c) =>
        (!formacaoSlug || c.formationSlug === formacaoSlug) &&
        matchesQuery(c, query) &&
        matchesObjective(c, objetivo)
    );

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    pushFilters({ q: query });
  };

  return (
    <>
      <form
        onSubmit={onSearchSubmit}
        className="mb-5"
        role="search"
        aria-label="Buscar cursos no catálogo"
      >
        <label htmlFor="catalogo-busca" className="sr-only">
          Buscar curso, tema ou formação
        </label>
        <div className="relative mx-auto max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--igh-muted)]"
            aria-hidden
          />
          <input
            id="catalogo-busca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar curso, tema ou formação…"
            className="w-full rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] py-3 pl-10 pr-24 text-sm text-[var(--igh-secondary)] placeholder:text-[var(--igh-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]/30"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isPending}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--igh-primary)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--igh-primary-hover)] disabled:opacity-60"
          >
            Buscar
          </button>
        </div>
      </form>

      {objetivo && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--igh-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--igh-primary)]">
            Objetivo: {OBJECTIVE_LABELS[objetivo]}
          </span>
          <button
            type="button"
            onClick={() => pushFilters({ objetivo: null })}
            className="text-xs font-medium text-[var(--igh-muted)] underline hover:text-[var(--igh-primary)]"
          >
            Limpar objetivo
          </button>
          {objectiveSoftFallback && (
            <span className="w-full text-xs text-[var(--igh-muted)] sm:w-auto">
              Exibindo o catálogo completo para este filtro — refine pela busca ou formação.
            </span>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--igh-secondary)]">Filtrar:</span>
        <Link
          href={buildHref({ formacao: null })}
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
            href={buildHref({ formacao: f.slug })}
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

      <p className="mb-4 text-sm text-[var(--igh-muted)]" aria-live="polite">
        {filtered.length === 0
          ? "Nenhum curso encontrado com esses filtros."
          : `${filtered.length} curso${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"}`}
        {isPending ? "…" : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--igh-border)] bg-[var(--igh-surface)] px-4 py-10 text-center">
          <p className="text-sm text-[var(--igh-muted)]">
            Tente outro termo, limpe os filtros ou explore todas as formações.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setQuery("");
                pushFilters({ formacao: null, q: "", objetivo: null });
              }}
              className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Ver todos os cursos
            </button>
            <Link
              href="/inscreva"
              className="rounded-lg border border-[var(--igh-border)] px-4 py-2 text-sm font-medium text-[var(--igh-secondary)]"
            >
              Ir para inscrição
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const detailsHref = `/cursos/${encodeURIComponent(c.slug)}`;
            const enrollHref = `/inscreva?courseId=${encodeURIComponent(c.id)}`;
            const hasOpen = c.hasOpenClassGroups === true;
            return (
              <Card key={c.id} as="article" className="flex h-full flex-col transition-shadow hover:shadow-md">
                {c.imageUrl && (
                  <Link href={detailsHref} className="relative block">
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="mb-3 h-32 w-full rounded-lg object-cover"
                    />
                    <span className="absolute left-2 top-2">
                      <Badge tone={hasOpen ? "primary" : "default"}>
                        {hasOpen ? "Turmas abertas" : "Em breve"}
                      </Badge>
                    </span>
                  </Link>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {!c.imageUrl && (
                    <Badge tone={hasOpen ? "primary" : "default"}>
                      {hasOpen ? "Turmas abertas" : "Em breve"}
                    </Badge>
                  )}
                </div>
                <Link href={detailsHref} className="block">
                  <h3 className="text-lg font-semibold text-[var(--igh-secondary)] hover:text-[var(--igh-primary)]">
                    {c.name}
                  </h3>
                </Link>
                {c.formationTitle && (
                  <p className="mt-1 text-xs font-medium text-[var(--igh-primary)]">
                    {c.formationTitle}
                  </p>
                )}
                <p className="mt-2 line-clamp-3 text-sm text-[var(--igh-muted)]">
                  {c.description ?? "Sem descrição."}
                </p>
                {c.workloadHours != null && (
                  <p className="mt-2 text-xs text-[var(--igh-muted)]">{c.workloadHours}h</p>
                )}
                <div className="mt-auto flex flex-col gap-2 pt-4">
                  {hasOpen ? (
                    <Link
                      href={enrollHref}
                      className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--igh-primary-hover)]"
                    >
                      Inscrever-se
                    </Link>
                  ) : (
                    <span
                      className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg border border-[var(--igh-border)] bg-[var(--igh-surface)] px-4 py-2 text-sm font-semibold text-[var(--igh-muted)]"
                      title="Ainda não há turmas com vagas para este curso"
                    >
                      Em breve
                    </span>
                  )}
                  <Link
                    href={detailsHref}
                    className="inline-flex w-full min-h-[40px] items-center justify-center rounded-lg border border-[var(--igh-border)] px-4 py-2 text-sm font-medium text-[var(--igh-secondary)] transition hover:bg-[var(--igh-surface)]"
                  >
                    Ver detalhes
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
