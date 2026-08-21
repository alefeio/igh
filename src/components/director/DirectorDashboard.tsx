"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Gift,
  Package,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  DashboardHero,
  PanelPageStack,
  SectionCard,
  StatTile,
  TableShell,
} from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import type {
  DirectorDashboardPayload,
  DirectorHighlightPerson,
  DirectorScopeMode,
} from "@/lib/director-dashboard-data";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function insightBoxClass(tone: "info" | "attention" | "positive"): string {
  if (tone === "attention") {
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
  }
  if (tone === "positive") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100";
  }
  return "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100";
}

function HighlightList({
  title,
  items,
}: {
  title: string;
  items: DirectorHighlightPerson[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--card-border)] p-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Sem dados neste recorte.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--card-border)] p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ol className="mt-2 space-y-2">
        {items.map((p, i) => (
          <li key={`${p.id}-${i}`} className="text-sm">
            <span className="font-medium text-[var(--text-muted)]">{i + 1}. </span>
            <span className="font-medium">{p.name}</span>
            <span className="text-[var(--text-muted)]">
              {" "}
              · {p.metricLabel}: {p.metricValue}
            </span>
            {p.extra ? (
              <div className="text-xs text-[var(--text-muted)]">{p.extra}</div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DirectorDashboard({ userName }: { userName: string }) {
  const toast = useToast();
  const [scope, setScope] = useState<DirectorScopeMode>("current");
  const [cycleId, setCycleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DirectorDashboardPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("scope", scope);
      if (scope === "cycle" && cycleId) sp.set("cycleId", cycleId);
      const res = await fetch(`/api/diretor/dashboard?${sp.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse<DirectorDashboardPayload>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message : "Falha ao carregar o painel.");
        return;
      }
      setData(json.data);
      if (scope === "cycle" && !cycleId && json.data.cycleId) {
        setCycleId(json.data.cycleId);
      }
    } catch {
      toast.push("error", "Falha de rede ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [scope, cycleId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const priorities = useMemo(
    () => (data?.insights.filter((i) => i.tone === "attention") ?? []).slice(0, 6),
    [data],
  );
  const contextInsights = useMemo(
    () => (data?.insights.filter((i) => i.tone !== "attention") ?? []).slice(0, 4),
    [data],
  );

  const occupationChart = useMemo(() => {
    if (!data) return [];
    return data.courses.slice(0, 10).map((c) => ({
      name: c.courseName.length > 28 ? `${c.courseName.slice(0, 26)}…` : c.courseName,
      ocupacao: c.ocupacaoPercent ?? 0,
    }));
  }, [data]);

  const territoryChart = useMemo(() => {
    if (!data) return [];
    return data.territories.slice(0, 10).map((t) => ({
      name: t.territorio.length > 22 ? `${t.territorio.slice(0, 20)}…` : t.territorio,
      ocupacao: t.ocupacaoPercent ?? 0,
    }));
  }, [data]);

  const saldoMes = data
    ? data.gerencia.financeiroEntradasMesCents - data.gerencia.financeiroSaidasMesCents
    : 0;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Diretoria — tomada de decisão"
        title={`Olá, ${userName.split(" ")[0]}`}
        description="Painel único: alertas, prioridades e indicadores consolidados. Sem páginas operacionais da Gerência — só o que importa para decidir."
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                size="sm"
                variant={scope === "current" ? "primary" : "secondary"}
                onClick={() => setScope("current")}
              >
                Ciclo atual
              </Button>
              <Button
                size="sm"
                variant={scope === "all" ? "primary" : "secondary"}
                onClick={() => setScope("all")}
              >
                Relatório geral
              </Button>
              <Button
                size="sm"
                variant={scope === "cycle" ? "primary" : "secondary"}
                onClick={() => setScope("cycle")}
              >
                Outro ciclo
              </Button>
            </div>
            {scope === "cycle" && data ? (
              <select
                className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                value={cycleId || data.cycleId || ""}
                onChange={(e) => {
                  setCycleId(e.target.value);
                  setScope("cycle");
                }}
              >
                {data.cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.isCurrent ? " (atual)" : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>
        }
      />

      {loading && !data ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando painel executivo…</p>
      ) : data ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            Recorte: <strong className="text-[var(--text-primary)]">{data.cycleLabel}</strong>
            {" · "}
            Atualizado em{" "}
            {new Date(data.updatedAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          <SectionCard
            title="Prioridades agora"
            description="Alertas que pedem ação. Leia o fato e a orientação — em seguida peça à equipe o encaminhamento."
            variant="elevated"
          >
            {priorities.length === 0 ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                Nenhum alerta crítico neste recorte. Continue monitorando ocupação e frequência.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {priorities.map((ins, i) => (
                  <div
                    key={`prio-${i}`}
                    className={`rounded-lg border px-4 py-3 text-sm ${insightBoxClass(ins.tone)}`}
                  >
                    <div className="flex items-start gap-2 font-semibold">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {ins.title}
                    </div>
                    <p className="mt-1 opacity-90">{ins.body}</p>
                    {ins.action ? (
                      <p className="mt-2 border-t border-current/15 pt-2 text-xs font-semibold uppercase tracking-wide">
                        Decisão: <span className="font-medium normal-case tracking-normal">{ins.action}</span>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <StatTile
              label="Ocupação"
              value={data.kpis.ocupacaoPercent != null ? `${data.kpis.ocupacaoPercent}%` : "—"}
              sublabel={`${data.kpis.inscritos} inscritos / ${data.kpis.capacidade} vagas`}
              accent="emerald"
            />
            <StatTile
              label="Freq. média"
              value={
                data.kpis.frequenciaMediaPercent != null
                  ? `${data.kpis.frequenciaMediaPercent}%`
                  : "—"
              }
              sublabel="Só aulas já ocorridas"
            />
            <StatTile
              label="Evasão (4 faltas)"
              value={data.kpis.evasao}
              accent="rose"
              sublabel="Consecutivas s/ justificativa"
            />
            <StatTile
              label="Ocupação crítica"
              value={data.kpis.turmasSemInscritos + data.kpis.turmasAbaixo30}
              accent="amber"
              sublabel={`${data.kpis.turmasSemInscritos} vazias · ${data.kpis.turmasAbaixo30} < 30%`}
            />
            <StatTile label="Suspensos" value={data.kpis.suspensos} accent="amber" />
            <StatTile
              label="Turmas"
              value={data.kpis.turmas}
              sublabel={`${data.kpis.turmasEmAndamento} em andamento · ${data.kpis.formados} formados`}
            />
          </div>

          {contextInsights.length > 0 ? (
            <SectionCard
              title="Leitura para decisão"
              description="Contexto positivo ou informativo — use para reforçar o que já funciona."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {contextInsights.map((ins, i) => (
                  <div
                    key={`ctx-${i}`}
                    className={`rounded-lg border px-4 py-3 text-sm ${insightBoxClass(ins.tone)}`}
                  >
                    <div className="font-semibold">{ins.title}</div>
                    <p className="mt-1 opacity-90">{ins.body}</p>
                    {ins.action ? (
                      <p className="mt-2 text-xs font-medium opacity-90">→ {ins.action}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Sinais da operação administrativa"
            description="Resumo para acompanhar riscos e resultados — a execução fica com a Gerência Administrativa."
            variant="elevated"
          >
            <div className="mb-4 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/60 px-4 py-3">
              <div className="flex items-center gap-2 font-semibold">
                <Gift className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
                Beneficiados no ano
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {data.gerencia.beneficiadosTermos} termo(s) · {data.gerencia.beneficiadosKits} kit(s)
                doados · {data.gerencia.doacoesAno} doação(ões) · {data.gerencia.donatariasAtivas}{" "}
                donatária(s) · {data.gerencia.doadorasAtivas} doadora(s)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile
                label="Colaboradores"
                value={data.gerencia.colaboradoresAtivos}
                sublabel={
                  data.gerencia.colaboradoresDocsPendentes > 0
                    ? `${data.gerencia.colaboradoresDocsPendentes} com docs pendentes`
                    : `${data.gerencia.colaboradoresTotal} no cadastro`
                }
                icon={Users}
                accent={data.gerencia.colaboradoresDocsPendentes > 0 ? "amber" : undefined}
              />
              <StatTile label="Contratos ativos" value={data.gerencia.contratosAtivos} />
              <StatTile
                label="Saldo do mês"
                value={formatCents(saldoMes)}
                sublabel={`Entradas ${formatCents(data.gerencia.financeiroEntradasMesCents)} · Saídas ${formatCents(data.gerencia.financeiroSaidasMesCents)}`}
                icon={Wallet}
                accent={saldoMes < 0 ? "rose" : "emerald"}
              />
              <StatTile
                label="Folha"
                value={data.gerencia.folhaCompetencia ?? "—"}
                sublabel={`${data.gerencia.folhaPagos} pagos · ${data.gerencia.folhaPendentes} pendentes`}
                accent={data.gerencia.folhaPendentes > 0 ? "amber" : undefined}
              />
              <StatTile
                label="Almoxarifado"
                value={data.gerencia.almoxarifadoItens}
                sublabel={
                  data.gerencia.almoxarifadoBaixoEstoque > 0
                    ? `${data.gerencia.almoxarifadoBaixoEstoque} em estoque baixo`
                    : "Estoque ok"
                }
                icon={Package}
                accent={data.gerencia.almoxarifadoBaixoEstoque > 0 ? "amber" : undefined}
              />
              <StatTile
                label="Doações (ano)"
                value={data.gerencia.doacoesAno}
                sublabel={`${data.gerencia.doacoesKitsAno} kits`}
                icon={Building2}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Evolução semanal de alunos"
            description="Matrículas acumuladas e ocupantes estimados no recorte."
          >
            {data.evolution.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Sem série temporal neste recorte.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.evolution}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="inscritosAcumulados"
                      name="Matrículas acumuladas"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ocupantesEstimados"
                      name="Ocupantes (estim.)"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Ocupação por curso" description="Top cursos do recorte.">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupationChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="ocupacao" name="Ocupação %" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Ocupação por território" description="Polos / locais.">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={territoryChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="ocupacao" name="Ocupação %" fill="#0284c7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Alunos (síntese)" description="Histórico e recorte selecionado.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Total histórico" value={data.students.totalHistorico} icon={Users} />
              <StatTile label="Únicos no recorte" value={data.students.unicosNoRecorte} />
              <StatTile label="Formados (matrículas)" value={data.students.formadosMatriculas} />
              <StatTile
                label="Freq. média"
                value={
                  data.students.frequenciaMediaPercent != null
                    ? `${data.students.frequenciaMediaPercent}%`
                    : "—"
                }
              />
              <StatTile label="Mais de um curso" value={data.students.comMaisDeUmCurso} accent="emerald" />
            </div>
          </SectionCard>

          <SectionCard
            title="Cursos — detalhe rápido"
            description="Só o necessário: ocupação, frequência (aulas passadas) e evasão."
          >
            <TableShell>
              <thead>
                <tr>
                  <Th>Curso</Th>
                  <Th>Turmas</Th>
                  <Th>Inscritos</Th>
                  <Th>Ocup.</Th>
                  <Th>Freq.</Th>
                  <Th>Evasão</Th>
                </tr>
              </thead>
              <tbody>
                {data.courses.map((c) => (
                  <tr key={c.courseId}>
                    <Td>{c.courseName}</Td>
                    <Td>{c.turmas}</Td>
                    <Td>{c.inscritos}</Td>
                    <Td>{c.ocupacaoPercent != null ? `${c.ocupacaoPercent}%` : "—"}</Td>
                    <Td>
                      {c.frequenciaMediaPercent != null ? `${c.frequenciaMediaPercent}%` : "—"}
                    </Td>
                    <Td>{c.evasao}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </SectionCard>

          <SectionCard
            title="Destaques (referência)"
            description="Para reconhecer boas práticas — não substitui as prioridades acima."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <HighlightList title="Professores — carga" items={data.highlights.teachersByLoad} />
              <HighlightList title="Professores — ocupação" items={data.highlights.teachersByOccupation} />
              <HighlightList title="Alunos — pontos" items={data.highlights.studentsByPoints} />
              <HighlightList title="Alunos — frequência" items={data.highlights.studentsByAttendance} />
              <HighlightList title="Alunos — exercícios" items={data.highlights.studentsByExercises} />
              <HighlightList title="Alunos — fórum" items={data.highlights.studentsByForum} />
            </div>
          </SectionCard>
        </>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Não foi possível carregar os dados.</p>
      )}
    </PanelPageStack>
  );
}
