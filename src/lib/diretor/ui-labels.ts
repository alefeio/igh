/** Rótulos de interface da área Diretor (sem jargão interno). */

export const DOMAIN_LABEL: Record<string, string> = {
  academic: "Acadêmico",
  offer: "Oferta e Territórios",
  social: "Impacto Social",
  financial: "Financeiro",
  administrative: "Administrativo",
  projects: "Projetos e Convênios",
  overview: "Visão Geral",
  guide: "Guia",
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  attention: "Atenção",
  info: "Informativo",
};

export const QUALITY_STATUS_LABEL: Record<string, string> = {
  ok: "Completo",
  partial: "Incompleto",
  unavailable: "Indisponível",
  estimated: "Estimado",
};

export function domainLabel(domain: string): string {
  return DOMAIN_LABEL[domain] ?? domain;
}

export function severityLabel(severity: string): string {
  return SEVERITY_LABEL[severity] ?? severity;
}

export function qualityStatusLabel(status: string): string {
  return QUALITY_STATUS_LABEL[status] ?? status;
}

export function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCompetenceMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return ym;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatFiltersHuman(filters: unknown): string {
  if (!filters || typeof filters !== "object") return "Recorte padrão da área";
  const f = filters as Record<string, unknown>;
  const parts: string[] = [];
  if (f.cycleLabel) parts.push(`Ciclo: ${String(f.cycleLabel)}`);
  if (f.scope === "all") parts.push("Todos os ciclos");
  if (f.scope === "current") parts.push("Ciclo atual");
  if (typeof f.execCompetence === "string" && f.execCompetence) {
    parts.push(`Competência executiva: ${formatCompetenceMonth(f.execCompetence)}`);
  }
  if (typeof f.competence === "string" && f.competence) {
    parts.push(`Competência: ${formatCompetenceMonth(f.competence)}`);
  }
  if (f.from || f.to) {
    parts.push(`Período: ${f.from ?? "início"} a ${f.to ?? "hoje"}`);
  }
  return parts.length ? parts.join(" · ") : "Recorte padrão da área";
}

export function centsToReais(cents: number): number {
  return cents / 100;
}
