import { BRAZIL_TIMEZONE } from "@/lib/format";

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
  partial: "Leitura parcial",
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

export function formatInstantPtBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}, às ${time}`;
}

/**
 * Data “ingênua” para Excel: o relógio de Brasília vira componentes UTC do Date,
 * porque o serial do Excel não tem fuso. Assim 14:10 BRT aparece 14:10 na célula.
 */
export function excelNaiveDateFromBrazilIso(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = num("year");
  const month = num("month");
  const day = num("day");
  const hour = num("hour");
  const minute = num("minute");
  if (![year, month, day, hour, minute].every((n) => Number.isFinite(n))) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

export function formatDataConsideredUntil(iso: string): string {
  return `Dados considerados até ${formatInstantPtBr(iso)}`;
}

export function formatUpdatedAtFriendly(iso: string): string {
  return `Atualizado em ${formatInstantPtBr(iso)}`;
}

/**
 * Se a geração e a data de referência coincidem (até 2 min), “Atualizado em”.
 * Caso contrário, “Dados considerados até” — não afirma que tudo foi gerado no mesmo instante.
 */
export function friendlyDataStamp(dataAsOf: string, generatedAt?: string): string {
  if (generatedAt) {
    const a = new Date(dataAsOf).getTime();
    const b = new Date(generatedAt).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 120_000) {
      return formatUpdatedAtFriendly(dataAsOf);
    }
  }
  return formatDataConsideredUntil(dataAsOf);
}

export function formatUpdatedAt(iso: string): string {
  return formatInstantPtBr(iso);
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
