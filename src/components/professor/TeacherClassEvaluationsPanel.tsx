"use client";

import { useEffect, useState } from "react";

import type { ApiResponse } from "@/lib/api-types";

type EvaluationItem = {
  id: string;
  rating: number;
  comment: string;
  anonymous: boolean;
  createdAt: string;
  authorLabel: string;
  courseName: string;
  classLabel: string;
  teacherName: string;
};

type ListPayload = {
  items: EvaluationItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

export function TeacherClassEvaluationsPanel({
  apiUrl,
  showTeacherName,
  revealIdentity = false,
  queryString = "",
  paginate = false,
  pageSize = 10,
}: {
  apiUrl: string;
  showTeacherName: boolean;
  revealIdentity?: boolean;
  /** Parâmetros de filtro (ciclo, curso, etc.), sem `page`/`pageSize`. */
  queryString?: string;
  paginate?: boolean;
  pageSize?: number;
}) {
  const [items, setItems] = useState<EvaluationItem[] | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [apiUrl, queryString, paginate, pageSize]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams(queryString);
        if (paginate) {
          params.set("page", String(page));
          params.set("pageSize", String(pageSize));
        }
        const qs = params.toString();
        const url = qs ? `${apiUrl}?${qs}` : apiUrl;
        const res = await fetch(url);
        const json = (await res.json()) as ApiResponse<ListPayload>;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(!json.ok ? json.error.message : "Não foi possível carregar as avaliações.");
          setItems([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        setItems(json.data.items);
        setTotal(json.data.total ?? json.data.items.length);
        setTotalPages(json.data.totalPages ?? 1);
        setError("");
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar as avaliações.");
          setItems([]);
          setTotal(0);
          setTotalPages(1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, queryString, paginate, page, pageSize]);

  return (
    <section className="mt-8" aria-labelledby="avaliacoes-professor-heading">
      <h2 id="avaliacoes-professor-heading" className="text-lg font-semibold text-[var(--text-primary)]">
        Avaliações do professor
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {revealIdentity
          ? "Notas de 1 a 5 enviadas na página da turma. Quando o aluno marca anônimo, o professor não vê a mensagem. A coordenação continua vendo o nome e o texto. Segue o mesmo recorte dos filtros."
          : "Notas e mensagens enviadas na página da turma. Avaliações anônimas não aparecem aqui — só a coordenação as vê."}
      </p>
      {items == null ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Carregando avaliações…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Nenhuma avaliação neste recorte.</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-[var(--text-primary)]">
                    {item.courseName}
                    {item.classLabel ? ` · ${item.classLabel}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{item.rating}/5</p>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {showTeacherName && item.teacherName ? `${item.teacherName} · ` : ""}
                  {item.authorLabel} · {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                  {item.anonymous ? (revealIdentity ? " · anônima para o professor" : " · anônima") : ""}
                </p>
                {item.comment ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.comment}</p> : null}
              </li>
            ))}
          </ul>
          {paginate && totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--text-muted)]">
                Página {page} de {totalPages} · {total}{" "}
                {total === 1 ? "avaliação" : "avaliações"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[var(--card-border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[var(--card-border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Próxima
                </button>
              </div>
            </div>
          ) : paginate ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              {total} {total === 1 ? "avaliação" : "avaliações"}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
