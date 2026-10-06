import type { IndicatorTone } from "@/components/coordenacao/PedagogicalMetricCard";

export type { IndicatorTone };

export type SnapshotCounts = {
  enrollments: number;
  started: number;
  atRisk: number;
  noShow: number;
  earlyDropout: number;
  dropout: number;
  completed: number;
};

export type SnapshotDefinitions = {
  attendanceRate: { value: number | null; available: boolean; definition?: string };
  dropoutRate: { value: number | null; available: boolean; definition?: string };
  completionRate: { value: number | null; available: boolean; definition?: string };
  startedRate: { value: number | null; available: boolean; definition?: string };
  noShowRate: { value: number | null; available: boolean; definition?: string };
};

/** Glossário curto para filtros e métricas. */
export const COORDINATOR_GLOSSARY = {
  tipoTurma:
    "Turmas da IGH (internas) ou turmas em parceria, fora da grade habitual (externas/parceiras).",
  vagasPreenchidas: "Quantas vagas das turmas já estão ocupadas por alunos ativos ou suspensos.",
  frequenciaMedia: "Média de presença nas aulas já realizadas. Sem chamada lançada, não conta como zero.",
  alunosEmRisco: "Alunos que ainda estão na turma e apresentaram sinais de atenção (faltas, baixa frequência, etc.).",
  evasao: "Entre quem já começou a frequentar, quantos saíram do curso.",
  conclusao:
    "Formados: alunos aptos a certificado (presença suficiente ou marcação do professor), não só quem tem status de matrícula concluída.",
} as const;

/** Substitui jargão técnico por linguagem pedagógica nos rótulos de gráficos. */
export function plainFunnelLabel(label: string): string {
  const map: Record<string, string> = {
    "Pré-matrícula": "Pré-matrícula (ainda não confirmada)",
    "Confirmada na coorte": "Matrícula confirmada",
    "Matrícula confirmada": "Matrícula confirmada",
    "Compareceu à primeira aula": "Veio à primeira aula",
    "Veio à primeira aula": "Veio à primeira aula",
    "Ainda na turma": "Continua na turma",
    "Continua na turma": "Continua na turma",
    "Chegou a 25% das aulas": "Chegou a 1/4 das aulas",
    "Chegou a 1/4 das aulas": "Chegou a 1/4 das aulas",
    "Chegou a 50% das aulas": "Chegou à metade das aulas",
    "Chegou à metade das aulas": "Chegou à metade das aulas",
    "Chegou a 75% das aulas": "Chegou a 3/4 das aulas",
    "Chegou a 3/4 das aulas": "Chegou a 3/4 das aulas",
    Concluiu: "Formados (apto a certificado)",
    "Concluiu o curso": "Formados (apto a certificado)",
    "Formados (apto a certificado)": "Formados (apto a certificado)",
  };
  return map[label] ?? label;
}

export function plainRetentionLabel(label: string): string {
  if (label === "Início") return "No início (já frequentaram)";
  if (label === "Conclusão da frequência") return "Conclusão";
  return label;
}

export type JourneySlice = { name: string; value: number; fill: string };

/** Fatias da jornada a partir das contagens do snapshot (para pizza). */
export function buildJourneySlices(counts: SnapshotCounts): JourneySlice[] {
  return [
    { name: "Formados", value: counts.completed, fill: "#059669" },
    { name: "Veio à 1ª aula", value: Math.max(0, counts.started - counts.completed - counts.earlyDropout - counts.dropout), fill: "#0284c7" },
    { name: "Não compareceram", value: counts.noShow, fill: "#94a3b8" },
    { name: "Saiu no começo", value: counts.earlyDropout, fill: "#ea580c" },
    { name: "Saiu depois de frequentar", value: counts.dropout, fill: "#dc2626" },
  ].filter((slice) => slice.value > 0);
}

export type PanelInsight = {
  headline: string;
  bullets: string[];
  tone: IndicatorTone;
};

export function buildPanelInsight(
  counts: SnapshotCounts,
  definitions: SnapshotDefinitions,
): PanelInsight {
  const attendance = definitions.attendanceRate.available ? definitions.attendanceRate.value : null;
  const dropout = definitions.dropoutRate.available ? definitions.dropoutRate.value : null;
  const bullets: string[] = [];

  if (counts.atRisk > 0) {
    bullets.push(
      counts.atRisk === 1
        ? "Há 1 aluno que precisa de atenção agora — abra a lista abaixo."
        : `Há ${counts.atRisk} alunos que precisam de atenção agora — abra a lista abaixo.`,
    );
  } else {
    bullets.push("Nenhum aluno em alerta neste recorte. Continue acompanhando a frequência.");
  }

  if (attendance != null) {
    bullets.push(
      attendance >= 70
        ? `A frequência média está boa (${attendance}%).`
        : `A frequência média está em ${attendance}% — vale reforçar o contato com quem falta.`,
    );
  } else {
    bullets.push("Ainda não há frequência lançada o bastante para calcular a média.");
  }

  if (dropout != null) {
    bullets.push(
      dropout === 0
        ? "Ninguém que começou a frequentar saiu do curso neste recorte."
        : `${dropout}% de quem já frequentava acabou saindo — veja os motivos na seção de jornada.`,
    );
  }

  if (counts.completed > 0) {
    bullets.push(
      counts.completed === 1
        ? "1 aluno já está formado (apto a certificado)."
        : `${counts.completed} alunos já estão formados (aptos a certificado).`,
    );
  }

  let tone: IndicatorTone = "neutral";
  if (counts.atRisk > 0 || (attendance != null && attendance < 70) || (dropout != null && dropout >= 15)) {
    tone = "warning";
  }
  if (counts.atRisk >= 5 || (attendance != null && attendance < 50) || (dropout != null && dropout >= 30)) {
    tone = "critical";
  }
  if (counts.atRisk === 0 && (attendance == null || attendance >= 70) && (dropout == null || dropout < 10)) {
    tone = "ok";
  }

  const headline =
    tone === "critical"
      ? "Priorize o acompanhamento dos alunos em alerta"
      : tone === "warning"
        ? "Há pontos de atenção neste ciclo"
        : "O ciclo está sob controle — continue acompanhando";

  return { headline, bullets: bullets.slice(0, 3), tone };
}

export function toneForAttendance(value: number | null | undefined): IndicatorTone {
  if (value == null) return "neutral";
  if (value >= 70) return "ok";
  if (value >= 50) return "warning";
  return "critical";
}

export function toneForRiskCount(count: number): IndicatorTone {
  if (count <= 0) return "ok";
  if (count < 5) return "warning";
  return "critical";
}

export function toneForDropout(value: number | null | undefined): IndicatorTone {
  if (value == null) return "neutral";
  if (value < 10) return "ok";
  if (value < 25) return "warning";
  return "critical";
}

export function countRiskByLevel(
  risk: Array<{ level: "CRITICAL" | "WARNING" | "ATTENTION" }>,
): Array<{ name: string; value: number; fill: string }> {
  const map = { CRITICAL: 0, WARNING: 0, ATTENTION: 0 };
  for (const row of risk) map[row.level] += 1;
  return [
    { name: "Risco alto", value: map.CRITICAL, fill: "#dc2626" },
    { name: "Atenção", value: map.WARNING, fill: "#ea580c" },
    { name: "Acompanhar", value: map.ATTENTION, fill: "#ca8a04" },
  ].filter((row) => row.value > 0);
}
