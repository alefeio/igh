import type { DerivedAlertDto } from "@/lib/diretor/schemas/common";

const RANK: Record<DerivedAlertDto["severity"], number> = { critical: 0, attention: 1, info: 2 };

/** Une alertas derivados de vários domínios, sem persistência nem responsável inventado. */
export function collectDirectorAlerts(groups: Array<DerivedAlertDto[] | undefined>): DerivedAlertDto[] {
  const all = groups.flatMap((g) => g ?? []);
  return all.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.title.localeCompare(b.title, "pt-BR"));
}

export function topPriorityAlerts(alerts: DerivedAlertDto[], max = 5): DerivedAlertDto[] {
  const crit = alerts.filter((a) => a.severity === "critical");
  if (crit.length >= max) return crit.slice(0, max);
  return [...crit, ...alerts.filter((a) => a.severity !== "critical")].slice(0, max);
}
