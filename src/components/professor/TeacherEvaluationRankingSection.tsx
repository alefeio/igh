"use client";

import { useEffect, useState } from "react";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";
import { formatBrazilDate } from "@/lib/format";
import type { PublicTeacherEvaluationRanking } from "@/lib/teacher-class-evaluation";

function formatAverage(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function TeacherEvaluationRankingSection() {
  const [rows, setRows] = useState<PublicTeacherEvaluationRanking[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/avaliacoes-professor/ranking");
        const json = (await res.json()) as ApiResponse<{ ranking: PublicTeacherEvaluationRanking[] }>;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(!json.ok ? json.error.message : "Não foi possível carregar o ranking.");
          setRows([]);
          return;
        }
        setRows(json.data.ranking);
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar o ranking.");
          setRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard
      title="Ranking dos professores"
      description="Média das avaliações públicas, da maior para a menor. Em cada professor, a última avaliação pública e a nota."
      variant="elevated"
    >
      {rows == null ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando ranking…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhuma avaliação pública ainda.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.teacherId} className="rounded-lg border border-[var(--card-border)] px-3 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--text-primary)]">
                  {index + 1}. {row.teacherName}
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  média {formatAverage(row.averageRating)}/5 · {row.evaluationCount}{" "}
                  {row.evaluationCount === 1 ? "avaliação" : "avaliações"}
                </p>
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Última avaliação pública · {row.latest.rating}/5
                {row.latest.authorLabel ? ` · ${row.latest.authorLabel}` : ""}
                {row.latest.courseName ? ` · ${row.latest.courseName}` : ""}
                {row.latest.classLabel ? ` · ${row.latest.classLabel}` : ""}
                {row.latest.at ? ` · ${formatBrazilDate(row.latest.at)}` : ""}
              </p>
              {row.latest.comment ? (
                <p className="mt-1 text-sm text-[var(--text-primary)]">{row.latest.comment}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
