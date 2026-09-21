"use client";

import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Info,
  Loader2,
  School,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DashboardHero,
  SectionCard,
  StatTile,
  TableShell,
} from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type CycleOption = {
  id: string;
  cycle: number;
  year: number;
  label: string;
  isVisibleForEnrollments: boolean;
};

type Metric = {
  key: string;
  label: string;
  value: number | string | null;
  hint?: string | null;
  suffix?: string | null;
};

type TurmaRow = {
  id: string;
  courseName: string;
  teachers: string;
  status: string;
  statusLabel: string;
  cycleLabel: string;
  location: string;
  capacity: number;
  inscritos: number;
  ocupacaoPercent: number | null;
  formados: number;
  taxaFormadosPercent: number | null;
  frequenciaMediaPercent: number | null;
  sessoesComChamada: number;
  sessoesPassadas: number;
  isExternal: boolean;
};

type DashboardPayload = {
  cycles: CycleOption[];
  years: number[];
  cycleNumbers: number[];
  teachers: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
  classGroups: Array<{ id: string; label: string; cycleId: string }>;
  summary: Metric[];
  byStatus: Array<{ status: string; label: string; count: number }>;
  turmaRows: TurmaRow[];
  notes: string[];
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "PLANEJADA", label: "Planejada" },
  { value: "ABERTA", label: "Aberta" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "ENCERRADA", label: "Encerrada" },
];

const selectClass =
  "theme-input w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)]";

function formatMetricValue(m: Metric): string {
  if (m.value == null) return "—";
  if (typeof m.value === "number" && m.suffix === "%") return `${m.value}${m.suffix}`;
  if (typeof m.value === "number") return String(m.value);
  return m.suffix ? `${m.value}${m.suffix}` : String(m.value);
}

function metricAccent(key: string): "default" | "emerald" | "violet" | "amber" | "sky" | "rose" {
  switch (key) {
    case "frequencia":
      return "emerald";
    case "formados":
    case "taxaFormados":
      return "violet";
    case "ocupacao":
      return "amber";
    case "alunos":
    case "inscritos":
      return "sky";
    case "chamadas":
      return "rose";
    default:
      return "default";
  }
}

function metricIcon(key: string) {
  switch (key) {
    case "turmas":
      return School;
    case "alunos":
    case "inscritos":
    case "preMatriculas":
      return Users;
    case "formados":
    case "taxaFormados":
    case "certificadosEmitidos":
      return GraduationCap;
    case "frequencia":
    case "chamadas":
      return ClipboardCheck;
    case "ocupacao":
      return BookOpen;
    default:
      return Info;
  }
}

function pctLabel(n: number | null): string {
  return n == null ? "—" : `${n}%`;
}

export function PedagogicalDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

  const [cycleIds, setCycleIds] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [cycleNumber, setCycleNumber] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [classGroupStatus, setClassGroupStatus] = useState("");
  const [isExternal, setIsExternal] = useState("");
  const [initialized, setInitialized] = useState(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (cycleIds.length > 0) params.set("cycleIds", cycleIds.join(","));
    if (year) params.set("year", year);
    if (cycleNumber) params.set("cycleNumber", cycleNumber);
    if (classGroupId) params.set("classGroupId", classGroupId);
    if (teacherId) params.set("teacherId", teacherId);
    if (courseId) params.set("courseId", courseId);
    if (classGroupStatus) params.set("classGroupStatus", classGroupStatus);
    if (isExternal) params.set("isExternal", isExternal);
    return params.toString();
  }, [cycleIds, year, cycleNumber, classGroupId, teacherId, courseId, classGroupStatus, isExternal]);

  // Na primeira carga, aplica ciclos visíveis para matrícula antes de buscar métricas.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/pedagogico/dashboard", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<DashboardPayload>;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error.message || "Falha ao carregar o dashboard.");
          setPayload(null);
          setInitialized(true);
          return;
        }
        setPayload(json.data);
        const visible = json.data.cycles.filter((c) => c.isVisibleForEnrollments).map((c) => c.id);
        setCycleIds(visible);
        setInitialized(true);
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar o dashboard pedagógico.");
          setPayload(null);
          setInitialized(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!initialized) return;
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery();
      const res = await fetch(`/api/admin/pedagogico/dashboard${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse<DashboardPayload>;
      if (!json.ok) {
        setError(json.error.message || "Falha ao carregar o dashboard.");
        setPayload(null);
        return;
      }
      setPayload(json.data);
    } catch {
      setError("Não foi possível carregar o dashboard pedagógico.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, initialized]);

  useEffect(() => {
    if (!initialized) return;
    void load();
  }, [initialized, load]);

  const turmaOptions = useMemo(() => {
    if (!payload) return [];
    if (cycleIds.length === 0) return payload.classGroups;
    const allowed = new Set(cycleIds);
    return payload.classGroups.filter((cg) => allowed.has(cg.cycleId));
  }, [payload, cycleIds]);

  function toggleCycle(id: string) {
    setClassGroupId("");
    setCycleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectVisibleCycles() {
    if (!payload) return;
    setClassGroupId("");
    setCycleIds(payload.cycles.filter((c) => c.isVisibleForEnrollments).map((c) => c.id));
  }

  function clearFilters() {
    setYear("");
    setCycleNumber("");
    setClassGroupId("");
    setTeacherId("");
    setCourseId("");
    setClassGroupStatus("");
    setIsExternal("");
    if (payload) {
      setCycleIds(payload.cycles.filter((c) => c.isVisibleForEnrollments).map((c) => c.id));
    } else {
      setCycleIds([]);
    }
  }

  const summaryPrimary = payload?.summary.filter((m) =>
    ["turmas", "alunos", "inscritos", "ocupacao", "frequencia", "formados"].includes(m.key),
  );
  const summarySecondary = payload?.summary.filter(
    (m) => !["turmas", "alunos", "inscritos", "ocupacao", "frequencia", "formados"].includes(m.key),
  );

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-4 sm:gap-10">
      <DashboardHero
        eyebrow="Pedagógico"
        title="Dashboard"
        description="Resumo geral de ciclos, turmas, alunos, frequência e formados. Indicadores só aparecem quando há base real nos filtros — nada é inventado."
        rightSlot={
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Atualizando…
              </>
            ) : (
              "Atualizar"
            )}
          </Button>
        }
      />

      <SectionCard
        title="Filtros"
        description="Combine ciclo, ano, número do ciclo, turma, curso, professor, status e tipo (interna/externa)."
        variant="elevated"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Ano</span>
            <select className={selectClass} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Todos</option>
              {(payload?.years ?? []).map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Nº do ciclo (semestre)</span>
            <select
              className={selectClass}
              value={cycleNumber}
              onChange={(e) => setCycleNumber(e.target.value)}
            >
              <option value="">Todos</option>
              {(payload?.cycleNumbers ?? []).map((n) => (
                <option key={n} value={String(n)}>
                  Ciclo {n}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Curso</span>
            <select className={selectClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Todos</option>
              {(payload?.courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Professor</span>
            <select className={selectClass} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Todos</option>
              {(payload?.teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Turma</span>
            <select
              className={selectClass}
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
            >
              <option value="">Todas</option>
              {turmaOptions.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Status da turma</span>
            <select
              className={selectClass}
              value={classGroupStatus}
              onChange={(e) => setClassGroupStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Tipo</span>
            <select className={selectClass} value={isExternal} onChange={(e) => setIsExternal(e.target.value)}>
              <option value="">Internas e externas</option>
              <option value="false">Só internas</option>
              <option value="true">Só externas</option>
            </select>
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Ciclos</span>
            <Button type="button" variant="secondary" size="sm" onClick={selectVisibleCycles}>
              Só visíveis para matrícula
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setCycleIds([])}>
              Limpar ciclos
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Resetar filtros
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(payload?.cycles ?? []).map((c) => {
              const on = cycleIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCycle(c.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    on
                      ? "bg-[var(--igh-primary)] text-white"
                      : "bg-[var(--igh-surface)] text-[var(--igh-muted)] hover:bg-[var(--card-border)]"
                  }`}
                  title={c.isVisibleForEnrollments ? "Visível para matrículas" : "Não visível para matrículas"}
                >
                  {c.label}
                  {c.isVisibleForEnrollments ? "" : " · oculto"}
                </button>
              );
            })}
            {!payload?.cycles.length && !loading ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhum ciclo cadastrado.</p>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-[var(--text-primary)]"
        >
          {error}
        </div>
      ) : null}

      {loading && !payload ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando indicadores…
        </div>
      ) : null}

      {payload ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(summaryPrimary ?? []).map((m) => (
              <StatTile
                key={m.key}
                label={m.label}
                value={formatMetricValue(m)}
                sublabel={m.hint ?? undefined}
                icon={metricIcon(m.key)}
                accent={metricAccent(m.key)}
              />
            ))}
          </div>

          {(summarySecondary?.length ?? 0) > 0 ? (
            <SectionCard title="Indicadores complementares" description="Só exibidos com base nos dados filtrados.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summarySecondary!.map((m) => (
                  <StatTile
                    key={m.key}
                    label={m.label}
                    value={formatMetricValue(m)}
                    sublabel={m.hint ?? undefined}
                    icon={metricIcon(m.key)}
                    accent={metricAccent(m.key)}
                  />
                ))}
              </div>
            </SectionCard>
          ) : null}

          {payload.byStatus.length > 0 ? (
            <SectionCard title="Turmas por status" description="Distribuição no filtro atual (exclui canceladas).">
              <div className="flex flex-wrap gap-2">
                {payload.byStatus.map((s) => (
                  <div
                    key={s.status}
                    className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-2 text-sm"
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{s.label}</span>
                    <span className="ml-2 tabular-nums text-[var(--text-muted)]">{s.count}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {payload.notes.length > 0 ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p className="mb-1.5 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <Info className="h-4 w-4 shrink-0" aria-hidden />
                Observações (dados insuficientes ou regras de cálculo)
              </p>
              <ul className="list-inside list-disc space-y-1">
                {payload.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <SectionCard
            title="Detalhe por turma"
            description="Ocupação, frequência média e formados (estes últimos só em turmas encerradas)."
            action={
              <Link
                href="/class-groups"
                className="text-sm font-semibold text-[var(--igh-primary)] hover:underline"
              >
                Ir para Turmas
              </Link>
            }
          >
            {payload.turmaRows.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Sem turmas neste filtro. Ajuste ciclo/ano/professor ou outros critérios.
              </p>
            ) : (
              <TableShell>
                <Table>
                  <thead>
                    <tr>
                      <Th>Curso / turma</Th>
                      <Th>Ciclo</Th>
                      <Th>Status</Th>
                      <Th>Professor(es)</Th>
                      <Th>Inscritos</Th>
                      <Th>Ocupação</Th>
                      <Th>Frequência</Th>
                      <Th>Formados</Th>
                      <Th>Chamada</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.turmaRows.map((row) => (
                      <tr key={row.id}>
                        <Td>
                          <div className="font-medium text-[var(--text-primary)]">{row.courseName}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {row.location}
                            {row.isExternal ? " · Externa" : ""}
                          </div>
                        </Td>
                        <Td>{row.cycleLabel}</Td>
                        <Td>{row.statusLabel}</Td>
                        <Td>{row.teachers}</Td>
                        <Td>
                          {row.inscritos}/{row.capacity}
                        </Td>
                        <Td>{pctLabel(row.ocupacaoPercent)}</Td>
                        <Td>
                          {row.frequenciaMediaPercent == null ? (
                            <span title="Sem frequência lançada ou sem aulas elegíveis">—</span>
                          ) : (
                            pctLabel(row.frequenciaMediaPercent)
                          )}
                        </Td>
                        <Td>
                          {row.status === "ENCERRADA" ? (
                            <>
                              {row.formados}
                              {row.taxaFormadosPercent != null ? (
                                <span className="ml-1 text-xs text-[var(--text-muted)]">
                                  ({row.taxaFormadosPercent}%)
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-[var(--text-muted)]" title="Só em turmas encerradas">
                              —
                            </span>
                          )}
                        </Td>
                        <Td>
                          {row.sessoesPassadas === 0
                            ? "—"
                            : `${row.sessoesComChamada}/${row.sessoesPassadas}`}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableShell>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
