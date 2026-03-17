"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Course = { id: string; name: string };
type Teacher = { id: string; name: string };

type ClassGroup = {
  id: string;
  courseId: string;
  teacherId: string;
  daysOfWeek: string[];
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
  status: string;
  location: string | null;
  course: Course;
  teacher: Teacher;
};

const DAY_ORDER = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const DAY_LABELS: Record<string, string> = {
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado",
  DOM: "Domingo",
};

function formatDays(days: string[]): string {
  if (!days?.length) return "—";
  const sorted = [...days].sort(
    (a, b) => DAY_ORDER.indexOf(a as (typeof DAY_ORDER)[number]) - DAY_ORDER.indexOf(b as (typeof DAY_ORDER)[number])
  );
  return sorted.map((d) => DAY_LABELS[d] ?? d).join(", ");
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const datePart = d.trim().split("T")[0];
  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, day] = datePart.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_IN_SCHEDULE = ["PLANEJADA", "ABERTA", "EM_ANDAMENTO"] as const;

export default function QuadroHorariosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [includeEncerradas, setIncludeEncerradas] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/class-groups");
      const json = (await res.json()) as ApiResponse<{ classGroups: ClassGroup[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao carregar." : "Falha ao carregar.");
        return;
      }
      setClassGroups(json.data.classGroups ?? []);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = includeEncerradas
    ? classGroups
    : classGroups.filter((cg) => STATUS_IN_SCHEDULE.includes(cg.status as (typeof STATUS_IN_SCHEDULE)[number]));

  const sorted = [...filtered].sort((a, b) => {
    const byCourse = (a.course?.name ?? "").localeCompare(b.course?.name ?? "", "pt-BR");
    if (byCourse !== 0) return byCourse;
    const byTime = (a.startTime ?? "").localeCompare(b.startTime ?? "");
    if (byTime !== 0) return byTime;
    return (a.startDate ?? "").localeCompare(b.startDate ?? "");
  });

  function handleExportPdf() {
    const el = document.getElementById("quadro-print-area");
    if (!el) return;
    const html = el.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.push("error", "Permita pop-ups para exportar o PDF.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Quadro de Horários dos Cursos</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #171717; }
            h1 { font-size: 1.5rem; margin-bottom: 8px; }
            .sub { font-size: 0.875rem; color: #52525b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
            th, td { border: 1px solid #e4e4e7; padding: 10px 12px; text-align: left; }
            th { background: #f5f7fa; font-weight: 600; }
            tr:nth-child(even) { background: #fafafa; }
          </style>
        </head>
        <body>
          ${html}
          <script>
            setTimeout(function() { window.print(); window.close(); }, 250);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.push("success", "Use a opção \"Salvar como PDF\" na janela de impressão.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Quadro de horários dos cursos
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Use o botão abaixo para exportar ou imprimir e disponibilizar no instituto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeEncerradas}
              onChange={(e) => setIncludeEncerradas(e.target.checked)}
            />
            Incluir turmas encerradas
          </label>
          <Button onClick={handleExportPdf} disabled={loading || sorted.length === 0}>
            Exportar / Imprimir PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center text-sm text-[var(--text-muted)]">
          Nenhuma turma encontrada para exibir no quadro.
        </div>
      ) : (
        <>
          {/* Área usada na impressão / PDF */}
          <div id="quadro-print-area" className="sr-only print:not-sr-only">
            <h1>Quadro de Horários dos Cursos</h1>
            <p className="sub">
              Gerado em {new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })} — Para consulta dos alunos.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Dias da semana</th>
                  <th>Horário</th>
                  <th>Professor(a)</th>
                  <th>Local</th>
                  <th>Início</th>
                  <th>Término</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((cg) => (
                  <tr key={cg.id}>
                    <td>{cg.course?.name ?? "—"}</td>
                    <td>{formatDays(cg.daysOfWeek)}</td>
                    <td>{cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—"}</td>
                    <td>{cg.teacher?.name ?? "—"}</td>
                    <td>{cg.location?.trim() || "—"}</td>
                    <td>{formatDate(cg.startDate)}</td>
                    <td>{formatDate(cg.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabela visível na tela (mesmos dados) */}
          <div className="overflow-x-auto rounded border border-[var(--border)] print:hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--igh-surface)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Curso</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Dias da semana</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Horário</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Professor(a)</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Local</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Início</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Término</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((cg) => (
                  <tr key={cg.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-2 text-[var(--text-primary)]">{cg.course?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{formatDays(cg.daysOfWeek)}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">
                      {cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{cg.teacher?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{cg.location?.trim() || "—"}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{formatDate(cg.startDate)}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{formatDate(cg.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
