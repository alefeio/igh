"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileDown, Trash2 } from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { PLATFORM_EXPERIENCE_SORT, type PlatformExperienceSort } from "@/lib/platform-experience-sort";

type Summary = {
  totalCount: number;
  avgPlatform: number | null;
  avgLessons: number | null;
  avgTeacher: number | null;
  /** Presentes na API admin/professor com agregados; opcionais por compatibilidade. */
  minPlatform?: number | null;
  maxPlatform?: number | null;
  minLessons?: number | null;
  maxLessons?: number | null;
  minTeacher?: number | null;
  maxTeacher?: number | null;
};

type Item = {
  id: string;
  userId: string;
  userName: string;
  turmaLabel: string;
  teacherNames: string[];
  ratingPlatform: number;
  ratingLessons: number;
  ratingTeacher: number;
  commentPlatform: string | null;
  commentLessons: string | null;
  commentTeacher: string | null;
  referral: string | null;
  createdAt: string;
};

type FilterOptions = {
  courses: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
};

type ListPayload = {
  summary: Summary;
  items: Item[];
  canDeleteEvaluations?: boolean;
  filterOptions?: FilterOptions;
};

function fmtAvg(n: number | null) {
  return n == null ? "—" : n.toFixed(1);
}

function fmtScore(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return String(n);
}

const SORT_LABELS: Record<PlatformExperienceSort, string> = {
  newest: "Mais recentes",
  oldest: "Mais antigas",
  best: "Melhor avaliação (soma das notas)",
  worst: "Pior avaliação (soma das notas)",
};

export function PlatformExperienceEvaluationsClient({
  apiUrl,
  exportUrl,
  exportPdfUrl,
  pageTitle,
  pageDescription,
  variant = "teacher",
}: {
  apiUrl: string;
  exportUrl?: string;
  /** GET que devolve application/pdf (mesmos filtros do CSV no modo admin). */
  exportPdfUrl?: string;
  pageTitle: string;
  pageDescription: string;
  /** `admin`: filtros, ordenação, exclusão (master), min/max nos cards. */
  variant?: "admin" | "teacher";
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  const [sort, setSort] = useState<PlatformExperienceSort>("newest");
  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const listUrl = useMemo(() => {
    if (variant !== "admin") return apiUrl;
    const p = new URLSearchParams();
    p.set("sort", sort);
    if (courseId) p.set("courseId", courseId);
    if (teacherId) p.set("teacherId", teacherId);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    const qs = p.toString();
    return `${apiUrl}?${qs}`;
  }, [apiUrl, variant, sort, courseId, teacherId, dateFrom, dateTo]);

  const exportUrlWithQuery = useMemo(() => {
    if (!exportUrl) return null;
    if (variant !== "admin") return exportUrl;
    const p = new URLSearchParams();
    p.set("sort", sort);
    if (courseId) p.set("courseId", courseId);
    if (teacherId) p.set("teacherId", teacherId);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    const qs = p.toString();
    return `${exportUrl}?${qs}`;
  }, [exportUrl, variant, sort, courseId, teacherId, dateFrom, dateTo]);

  const exportPdfUrlWithQuery = useMemo(() => {
    if (!exportPdfUrl) return null;
    if (variant !== "admin") return exportPdfUrl;
    const p = new URLSearchParams();
    p.set("sort", sort);
    if (courseId) p.set("courseId", courseId);
    if (teacherId) p.set("teacherId", teacherId);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    const qs = p.toString();
    return `${exportPdfUrl}?${qs}`;
  }, [exportPdfUrl, variant, sort, courseId, teacherId, dateFrom, dateTo]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl, { credentials: "include" });
      const json = (await res.json()) as ApiResponse<ListPayload>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar avaliações.",
        );
        return;
      }
      setSummary(json.data.summary);
      setItems(json.data.items);
      setCanDelete(Boolean(json.data.canDeleteEvaluations));
      setFilterOptions(json.data.filterOptions ?? null);
    } finally {
      setLoading(false);
    }
  }, [listUrl, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleExportCsv() {
    if (!exportUrlWithQuery) return;
    setExporting(true);
    try {
      const res = await fetch(exportUrlWithQuery, { credentials: "include" });
      if (!res.ok) {
        toast.push("error", "Não foi possível gerar o arquivo.");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition");
      let filename = "avaliacoes.csv";
      const m = dispo?.match(/filename="([^"]+)"/);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.push("error", "Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPdf() {
    if (!exportPdfUrlWithQuery) return;
    setExportingPdf(true);
    try {
      const res = await fetch(exportPdfUrlWithQuery, { credentials: "include" });
      if (!res.ok) {
        toast.push("error", "Não foi possível gerar o PDF.");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition");
      let filename = "avaliacoes-experiencia.pdf";
      const m = dispo?.match(/filename="([^"]+)"/);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.push("error", "Falha ao exportar PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  const handleDelete = useCallback(
    async (id: string) => {
      if (!canDelete || variant !== "admin") return;
      if (!window.confirm("Excluir esta avaliação permanentemente? Esta ação não pode ser desfeita.")) {
        return;
      }
      setDeletingId(id);
      try {
        const res = await fetch(`/api/admin/platform-experience-feedback/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
        if (!res.ok || !json?.ok) {
          toast.push(
            "error",
            json && !json.ok && "error" in json ? json.error.message : "Não foi possível excluir.",
          );
          return;
        }
        toast.push("success", "Avaliação excluída.");
        await loadData();
      } catch {
        toast.push("error", "Falha ao excluir.");
      } finally {
        setDeletingId(null);
      }
    },
    [canDelete, variant, toast, loadData],
  );

  const showDeleteColumn = variant === "admin" && canDelete;
  const colCount = showDeleteColumn ? 7 : 6;

  const referralItems = useMemo(
    () => items.filter((r) => Boolean(r.referral?.trim())),
    [items],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{pageDescription}</p>
        </div>
        {exportUrlWithQuery || exportPdfUrlWithQuery ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            {exportUrlWithQuery ? (
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                disabled={exporting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--igh-primary)]/10 disabled:opacity-60 sm:w-auto"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {exporting ? "Gerando…" : "Exportar CSV"}
              </button>
            ) : null}
            {exportPdfUrlWithQuery ? (
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exportingPdf}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--igh-primary)]/10 disabled:opacity-60 sm:w-auto"
              >
                <FileDown className="h-4 w-4 shrink-0" aria-hidden />
                {exportingPdf ? "Gerando PDF…" : "Exportar PDF"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {variant === "admin" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Ordenar por</label>
            <select
              className="theme-input mt-1 h-10 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--igh-primary)]"
              value={sort}
              onChange={(e) => setSort(e.target.value as PlatformExperienceSort)}
            >
              {PLATFORM_EXPERIENCE_SORT.map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Curso</label>
            <select
              className="theme-input mt-1 h-10 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--igh-primary)]"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Todos</option>
              {(filterOptions?.courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Professor</label>
            <select
              className="theme-input mt-1 h-10 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--igh-primary)]"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">Todos</option>
              {(filterOptions?.teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[9rem]">
            <label className="text-xs font-medium text-[var(--text-muted)]">Data inicial</label>
            <input
              type="date"
              className="theme-input mt-1 h-10 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--igh-primary)]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="min-w-[9rem]">
            <label className="text-xs font-medium text-[var(--text-muted)]">Data final</label>
            <input
              type="date"
              className="theme-input mt-1 h-10 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--igh-primary)]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="h-10 rounded-md border border-[var(--card-border)] px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
            onClick={() => {
              setSort("newest");
              setCourseId("");
              setTeacherId("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Total</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {summary.totalCount}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Plataforma</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtAvg(summary.avgPlatform)}
                <span className="text-sm font-normal text-[var(--text-muted)]"> /10</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                <span>
                  Melhor:{" "}
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">
                    {fmtScore(summary.maxPlatform)}
                  </span>
                  /10
                </span>
                <span>
                  Pior:{" "}
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">
                    {fmtScore(summary.minPlatform)}
                  </span>
                  /10
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Aulas</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtAvg(summary.avgLessons)}
                <span className="text-sm font-normal text-[var(--text-muted)]"> /10</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                <span>
                  Melhor:{" "}
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">
                    {fmtScore(summary.maxLessons)}
                  </span>
                  /10
                </span>
                <span>
                  Pior:{" "}
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">
                    {fmtScore(summary.minLessons)}
                  </span>
                  /10
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Professor</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtAvg(summary.avgTeacher)}
                <span className="text-sm font-normal text-[var(--text-muted)]"> /10</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                <span>
                  Melhor:{" "}
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">
                    {fmtScore(summary.maxTeacher)}
                  </span>
                  /10
                </span>
                <span>
                  Pior:{" "}
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">
                    {fmtScore(summary.minTeacher)}
                  </span>
                  /10
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Indicações</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Texto livre enviado pelo aluno sobre indicação (quem indicaria, contato etc.).
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm text-[var(--text-primary)]">
                <thead>
                  <tr>
                    <Th>Aluno</Th>
                    <Th>Indicação</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <Td colSpan={2} className="text-center text-[var(--text-muted)]">
                        Nenhuma avaliação registrada.
                      </Td>
                    </tr>
                  ) : referralItems.length === 0 ? (
                    <tr>
                      <Td colSpan={2} className="text-center text-[var(--text-muted)]">
                        Nenhum texto de indicação informado.
                      </Td>
                    </tr>
                  ) : (
                    referralItems.map((r) => (
                      <tr key={`ref-${r.id}`}>
                        <Td className="max-w-[12rem] text-sm font-medium text-[var(--text-primary)]">{r.userName}</Td>
                        <Td className="max-w-[32rem] whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                          {r.referral?.trim() ?? ""}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] sm:mx-0">
            <table className="min-w-full text-sm text-[var(--text-primary)]">
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Aluno</Th>
                  <Th title="Curso, local, dias da semana e horário (turmas ativas vinculadas ao aluno)">Turma</Th>
                  <Th title="Nota e comentário sobre a plataforma (abaixo, se houver)">Plat.</Th>
                  <Th title="Nota e comentário sobre as aulas (abaixo, se houver)">Aulas</Th>
                  <Th title="Nota e comentário sobre o(s) professor(es) (abaixo, se houver)">Prof.</Th>
                  {showDeleteColumn ? (
                    <Th className="text-center" title="Apenas usuário Master">
                      Excluir
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <Td colSpan={colCount} className="text-center text-[var(--text-muted)]">
                      Nenhuma avaliação registrada.
                    </Td>
                  </tr>
                ) : (
                  items.map((r) => {
                    const cp = r.commentPlatform?.trim();
                    const cl = r.commentLessons?.trim();
                    const ct = r.commentTeacher?.trim();
                    const hasTeacherNames =
                      Boolean(ct) && Array.isArray(r.teacherNames) && r.teacherNames.length > 0;
                    return (
                      <tr key={r.id}>
                        <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                          {new Date(r.createdAt).toLocaleString("pt-BR")}
                        </Td>
                        <Td className="text-sm font-medium text-[var(--text-primary)]">{r.userName}</Td>
                        <Td className="max-w-[14rem] whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                          {r.turmaLabel ?? "—"}
                        </Td>
                        <Td className="align-top">
                          <div className="tabular-nums text-sm font-medium text-[var(--text-primary)]">
                            {r.ratingPlatform}
                          </div>
                          {cp ? (
                            <div className="mt-1 max-w-[11rem] whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                              {r.commentPlatform}
                            </div>
                          ) : null}
                        </Td>
                        <Td className="align-top">
                          <div className="tabular-nums text-sm font-medium text-[var(--text-primary)]">
                            {r.ratingLessons}
                          </div>
                          {cl ? (
                            <div className="mt-1 max-w-[11rem] whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                              {r.commentLessons}
                            </div>
                          ) : null}
                        </Td>
                        <Td className="align-top">
                          <div className="tabular-nums text-sm font-medium text-[var(--text-primary)]">
                            {r.ratingTeacher}
                          </div>
                          {ct ? (
                            <div className="mt-1 max-w-[13rem] whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                              {hasTeacherNames ? (
                                <div className="font-medium text-[var(--text-muted)]">{r.teacherNames.join(", ")}</div>
                              ) : null}
                              <div className={hasTeacherNames ? "mt-0.5" : ""}>{r.commentTeacher}</div>
                            </div>
                          ) : null}
                        </Td>
                        {showDeleteColumn ? (
                          <Td className="text-center">
                            <button
                              type="button"
                              className="inline-flex rounded-md p-1.5 text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                              title="Excluir avaliação"
                              disabled={deletingId === r.id}
                              onClick={() => void handleDelete(r.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </Td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
