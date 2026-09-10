"use client";

import { BookOpen, CalendarDays, ClipboardList, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type NextCycleInterestItem = {
  id: string;
  name: string;
  phone: string;
  email: string;
  courseIds: string[];
  courseNames: string[];
  customCourseName: string | null;
  source: string | null;
  createdAt: string;
};

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function whatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length >= 10 && !digits.startsWith("55") ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function AdminPreInscricoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NextCycleInterestItem[]>([]);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/next-cycle-interests");
      const json = (await res.json()) as ApiResponse<{ items: NextCycleInterestItem[] }>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar.",
        );
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    if (!q) return items;
    return items.filter((item) => {
      const haystack = normalizeSearch(
        [
          item.name,
          item.email,
          item.phone,
          formatPhone(item.phone),
          item.courseNames.join(" "),
          item.customCourseName ?? "",
          item.source ?? "",
        ].join(" "),
      );
      return haystack.includes(q);
    });
  }, [items, query]);

  const summary = useMemo(() => {
    const todayStart = startOfLocalDay();
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    let today = 0;
    let last7Days = 0;
    let withCustomCourse = 0;
    let multiCourse = 0;
    let courseSelections = 0;
    const courseCounts = new Map<string, number>();

    for (const item of items) {
      const created = new Date(item.createdAt);
      if (created >= todayStart) today += 1;
      if (created >= weekStart) last7Days += 1;
      if (item.customCourseName?.trim()) withCustomCourse += 1;

      const listed = item.courseNames.filter((n) => !n.startsWith("Outro:"));
      const totalCourses = listed.length + (item.customCourseName?.trim() ? 1 : 0);
      if (totalCourses > 1) multiCourse += 1;
      courseSelections += totalCourses;

      for (const name of item.courseNames) {
        courseCounts.set(name, (courseCounts.get(name) ?? 0) + 1);
      }
    }

    const topCourses = [...courseCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, 8);

    const avgCourses =
      items.length === 0 ? 0 : Math.round((courseSelections / items.length) * 10) / 10;

    return {
      total: items.length,
      today,
      last7Days,
      withCustomCourse,
      multiCourse,
      avgCourses,
      topCourses,
      distinctCourses: courseCounts.size,
    };
  }, [items]);

  function exportExcel() {
    if (exporting || filtered.length === 0) return;
    setExporting(true);
    try {
      const rows = filtered.map((item) => ({
        Data: formatDateTime(item.createdAt),
        Nome: item.name,
        "E-mail": item.email,
        Telefone: formatPhone(item.phone),
        Cursos: item.courseNames.join("; "),
        Origem: item.source ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 28 },
        { wch: 32 },
        { wch: 16 },
        { wch: 50 },
        { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pré-inscrições");
      XLSX.writeFile(wb, `pre_inscricoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.push("success", "Relatório Excel exportado.");
    } catch {
      toast.push("error", "Falha ao exportar o Excel.");
    } finally {
      setExporting(false);
    }
  }

  const topCourseMax = summary.topCourses[0]?.[1] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">
            Pré-inscrições — próximo ciclo
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            Interessados cadastrados pelo formulário público /pre-inscricao. Inclui nome, contato e
            cursos pretendidos.
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={exportExcel}
          disabled={loading || exporting || filtered.length === 0}
          className="w-full shrink-0 sm:w-auto"
        >
          {exporting ? "Exportando…" : "Exportar Excel"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total"
          value={loading ? "—" : summary.total}
          icon={ClipboardList}
          sublabel="pré-inscrições recebidas"
        />
        <StatTile
          label="Hoje"
          value={loading ? "—" : summary.today}
          icon={Sparkles}
          accent="emerald"
          sublabel="cadastradas neste dia"
        />
        <StatTile
          label="Últimos 7 dias"
          value={loading ? "—" : summary.last7Days}
          icon={CalendarDays}
          accent="sky"
          sublabel="incluindo hoje"
        />
        <StatTile
          label="Cursos distintos"
          value={loading ? "—" : summary.distinctCourses}
          icon={BookOpen}
          accent="amber"
          sublabel={
            loading ? undefined : `média ${summary.avgCourses} curso(s) por pessoa`
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Cursos mais pretendidos
            </h2>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : summary.topCourses.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Ainda não há cursos selecionados nas pré-inscrições.
            </p>
          ) : (
            <ul className="list-none space-y-2.5 pl-0">
              {summary.topCourses.map(([name, count], index) => {
                const pct = topCourseMax > 0 ? Math.round((count / topCourseMax) * 100) : 0;
                return (
                  <li key={name}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-[var(--text-primary)]">
                        <span className="mr-2 font-semibold text-[var(--text-muted)]">
                          {index + 1}.
                        </span>
                        {name}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--igh-primary)]">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--igh-surface)]">
                      <div
                        className="h-full rounded-full bg-[var(--igh-primary)]/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Perfil das escolhas</h2>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
                <dt className="text-[var(--text-muted)]">Mais de um curso marcado</dt>
                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {summary.multiCourse}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
                <dt className="text-[var(--text-muted)]">Informaram “Outro” curso</dt>
                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {summary.withCustomCourse}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Média de cursos por pessoa</dt>
                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {summary.avgCourses}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <div className="max-w-md">
        <label
          htmlFor="pre-inscricoes-search"
          className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
        >
          Buscar
        </label>
        <Input
          id="pre-inscricoes-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, e-mail, telefone ou curso..."
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            {filtered.length === items.length
              ? `${items.length} pré-inscrição(ões)`
              : `${filtered.length} de ${items.length} pré-inscrição(ões)`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Telefone</Th>
                  <Th>Cursos</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <Td colSpan={5} className="text-center text-[var(--text-muted)]">
                      {items.length === 0
                        ? "Nenhuma pré-inscrição recebida."
                        : "Nenhum resultado para a busca."}
                    </Td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                        {formatDateTime(item.createdAt)}
                      </Td>
                      <Td className="font-medium text-[var(--text-primary)]">{item.name}</Td>
                      <Td>
                        <a
                          href={`mailto:${item.email}`}
                          className="text-[var(--igh-primary)] hover:underline"
                        >
                          {item.email}
                        </a>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <a
                          href={whatsAppLink(item.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--igh-primary)] hover:underline"
                          title="Abrir no WhatsApp"
                        >
                          {formatPhone(item.phone)}
                        </a>
                      </Td>
                      <Td className="max-w-md text-sm text-[var(--text-secondary)]">
                        {item.courseNames.length > 0 ? (
                          <ul className="list-disc space-y-0.5 pl-4">
                            {item.courseNames.map((name) => (
                              <li key={`${item.id}-${name}`}>{name}</li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
