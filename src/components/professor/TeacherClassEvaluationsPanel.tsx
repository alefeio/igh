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

export function TeacherClassEvaluationsPanel({
  apiUrl,
  showTeacherName,
  revealIdentity = false,
}: {
  apiUrl: string;
  showTeacherName: boolean;
  revealIdentity?: boolean;
}) {
  const [items, setItems] = useState<EvaluationItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(apiUrl);
        const json = (await res.json()) as ApiResponse<{ items: EvaluationItem[] }>;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(!json.ok ? json.error.message : "Não foi possível carregar as avaliações.");
          setItems([]);
          return;
        }
        setItems(json.data.items);
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar as avaliações.");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <section className="mt-8" aria-labelledby="avaliacoes-professor-heading">
      <h2 id="avaliacoes-professor-heading" className="text-lg font-semibold text-[var(--text-primary)]">
        Avaliações do professor
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {revealIdentity
          ? "Notas de 1 a 5 enviadas na página da turma. Quando o aluno marca anônimo, o professor não vê a mensagem. A coordenação continua vendo o nome e o texto."
          : "Notas e mensagens enviadas na página da turma. Avaliações anônimas não aparecem aqui — só a coordenação as vê."}
      </p>
      {items == null ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Carregando avaliações…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Nenhuma avaliação ainda.</p>
      ) : (
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
      )}
    </section>
  );
}
