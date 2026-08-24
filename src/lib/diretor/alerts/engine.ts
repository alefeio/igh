import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import type { DerivedAlertDto } from "@/lib/diretor/schemas/common";
import type { AdministrativeExecutiveFacts } from "@/lib/diretor/facts/types";
import type { AcademicExecutiveFacts } from "@/lib/diretor/facts/types";
import type { FinancialExecutiveFacts } from "@/lib/diretor/facts/types";
import type { OfferExecutiveFacts } from "@/lib/diretor/facts/types";
import type { ProjectExecutiveFacts } from "@/lib/diretor/facts/types";
import type { SocialExecutiveFacts } from "@/lib/diretor/facts/types";
import { formatCentsBRL } from "@/lib/employees";

const RANK: Record<DerivedAlertDto["severity"], number> = { critical: 0, attention: 1, info: 2 };

/** Une alertas já derivados. Não consulta loaders nem o banco. */
export function collectDirectorAlerts(groups: Array<DerivedAlertDto[] | undefined>): DerivedAlertDto[] {
  const all = groups.flatMap((g) => g ?? []);
  return all.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.title.localeCompare(b.title, "pt-BR"));
}

export function topPriorityAlerts(alerts: DerivedAlertDto[], max = 5): DerivedAlertDto[] {
  const crit = alerts.filter((a) => a.severity === "critical");
  if (crit.length >= max) return crit.slice(0, max);
  return [...crit, ...alerts.filter((a) => a.severity !== "critical")].slice(0, max);
}

export type ExecutiveFactsPack = {
  academic?: AcademicExecutiveFacts;
  offer?: OfferExecutiveFacts;
  social?: SocialExecutiveFacts;
  financial?: FinancialExecutiveFacts;
  administrative?: AdministrativeExecutiveFacts;
  projects?: ProjectExecutiveFacts;
};

/** Alertas a partir de fatos já calculados — sem nova consulta acadêmica ou temática. */
export function alertsFromExecutiveFacts(pack: ExecutiveFactsPack): DerivedAlertDto[] {
  const out: DerivedAlertDto[] = [];
  const v = FORMULA_VERSION_1C;

  if (pack.academic && pack.academic.criticalAbsenceRisk > 0) {
    out.push({
      id: "acad-critical-absences",
      ruleId: "acad.critical_absence_risk",
      ruleVersion: v,
      domain: "academic",
      severity: "critical",
      title: "Risco crítico por faltas consecutivas",
      fact: `${pack.academic.criticalAbsenceRisk} matrícula(s) ativas ou suspensas no limite de faltas consecutivas sem justificativa.`,
      value: pack.academic.criticalAbsenceRisk,
      period: pack.academic.periodLabel,
      impact: "Risco de desligamento automático por frequência.",
      suggestedDecision: "Priorizar acompanhamento pedagógico das turmas com esses casos.",
      href: "/diretor/academico",
      source: "frequência nas aulas",
      status: "não acompanhado pelo sistema",
    });
  }

  if (pack.offer && pack.offer.emptyClasses + pack.offer.below30 > 0) {
    out.push({
      id: "offer-low-occupancy",
      ruleId: "offer.low_occupancy",
      ruleVersion: v,
      domain: "offer",
      severity: "attention",
      title: "Turmas com ocupação crítica",
      fact: `${pack.offer.emptyClasses} turma(s) vazia(s) e ${pack.offer.below30} abaixo de 30%.`,
      value: pack.offer.emptyClasses + pack.offer.below30,
      period: pack.offer.periodLabel,
      impact: "Capacidade ociosa no recorte.",
      suggestedDecision: "Rever oferta e demanda com a coordenação.",
      href: "/diretor/oferta-territorios",
      source: "ocupação das turmas",
      status: "não acompanhado pelo sistema",
    });
  }

  if (pack.financial && pack.financial.openAge91PlusCents > 0) {
    out.push({
      id: "fin-open-age-90",
      ruleId: "fin.open_age_91",
      ruleVersion: v,
      domain: "financial",
      severity: "attention",
      title: "Lançamentos em aberto há mais de 90 dias",
      fact: `Existem lançamentos em aberto há mais de 90 dias (${formatCentsBRL(pack.financial.openAge91PlusCents)}).`,
      value: pack.financial.openAge91PlusCents,
      period: pack.financial.periodLabel,
      impact: "Registros em aberto com idade elevada — não implica vencimento (não há dueDate).",
      suggestedDecision:
        "Solicitar à equipe financeira a revisão da situação desses registros.",
      href: "/diretor/financeiro",
      source: "FinancialEntry.entryDate (idade em aberto)",
      status: "não acompanhado pelo sistema",
    });
  }

  if (pack.administrative && pack.administrative.contractsExpired > 0) {
    out.push({
      id: "adm-contracts-expired",
      ruleId: "adm.contracts_expired",
      ruleVersion: v,
      domain: "administrative",
      severity: "attention",
      title: "Contratos com fim de vigência anterior à data de referência",
      fact: `${pack.administrative.contractsExpired} contrato(s) ativos com data de término anterior à atualização dos dados.`,
      value: pack.administrative.contractsExpired,
      period: "estoque",
      impact: "Vínculos sem vigência formal no cadastro.",
      suggestedDecision: "Regularizar renovação ou encerramento com a gerência de pessoas.",
      href: "/diretor/administrativo",
      source: "EmployeeContract.endDate",
      status: "não acompanhado pelo sistema",
    });
  }

  if (pack.administrative && pack.administrative.stockCritical > 0) {
    out.push({
      id: "adm-stock",
      ruleId: "adm.inventory_critical",
      ruleVersion: v,
      domain: "administrative",
      severity: "attention",
      title: "Estoque zerado ou no mínimo",
      fact: `${pack.administrative.inventoryZero} item(ns) zerado(s) e ${pack.administrative.inventoryBelowMin} no mínimo (um alerta agregado).`,
      value: pack.administrative.stockCritical,
      period: "estoque",
      impact: "Ruptura operacional de materiais.",
      suggestedDecision: "Reposição dos itens críticos.",
      href: "/diretor/administrativo",
      source: "InventoryItem",
      status: "não acompanhado pelo sistema",
    });
  }

  if (pack.social && pack.social.computersTarget != null && pack.social.computersDonated < pack.social.computersTarget) {
    out.push({
      id: "soc-computers-goal",
      ruleId: "soc.computers_below_target",
      ruleVersion: v,
      domain: "social",
      severity: "info",
      title: "Meta de computadores ainda não atingida",
      fact: `${pack.social.computersDonated} doados no ano versus meta ${pack.social.computersTarget}.`,
      value: pack.social.computersDonated,
      denominator: String(pack.social.computersTarget),
      period: pack.social.periodLabel,
      impact: "Entrega de equipamentos abaixo da meta anual.",
      suggestedDecision: "Acompanhar doações restantes no ano.",
      href: "/diretor/impacto-social",
      source: "Donation CONFIRMADA × AnnualGoal",
      status: "não acompanhado pelo sistema",
    });
  }

  if (pack.projects?.unavailable) {
    out.push({
      id: "proj-unavailable",
      ruleId: "proj.portfolio_unavailable",
      ruleVersion: v,
      domain: "projects",
      severity: "info",
      title: "Portfólio de projetos indisponível",
      fact: "Não há cadastro estruturado de projetos e convênios institucionais.",
      period: pack.projects.periodLabel,
      impact: "Acompanhamento de vigência e metas de convênio não é possível neste sistema.",
      suggestedDecision: "Tratar a página Projetos como estado estrutural, não como zero de portfólio.",
      href: "/diretor/projetos-convenios",
      source: "cadastro institucional",
      status: "não acompanhado pelo sistema",
    });
  }

  return collectDirectorAlerts([out]);
}
