import { FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import {
  CANCELLATION_PERIOD_UNAVAILABLE_REASON,
  INFERRED_ABSENCE_CANCELLATION_COPY,
} from "@/lib/diretor/metrics/enrollment-formulas";
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
  const actionable = alerts.filter((a) => a.severity === "critical" || a.severity === "attention");
  const crit = actionable.filter((a) => a.severity === "critical");
  if (crit.length >= max) return crit.slice(0, max);
  return [...crit, ...actionable.filter((a) => a.severity === "attention")].slice(0, max);
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

  if (pack.academic && pack.academic.attendanceReliable && pack.academic.nearSuspension > 0) {
    out.push({
      id: "acad-near-suspension",
      ruleId: "acad.near_suspension",
      ruleVersion: v,
      domain: "academic",
      severity: "attention",
      title: "Alunos próximos da suspensão",
      fact: `${pack.academic.nearSuspension} matrícula(s) ativa(s) com duas faltas consecutivas sem justificativa.`,
      value: pack.academic.nearSuspension,
      period: pack.academic.periodLabel,
      impact: "Próxima falta consecutiva sem justificativa leva à suspensão.",
      suggestedDecision: "Orientar a coordenação a realizar contato preventivo.",
      href: "/diretor/academico",
      source: "frequência nas aulas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  if (pack.academic && pack.academic.suspensions > 0) {
    out.push({
      id: "acad-suspensions",
      ruleId: "acad.suspensions",
      ruleVersion: v,
      domain: "academic",
      severity: "critical",
      title: "Matrículas suspensas",
      fact: `${pack.academic.suspensions} matrícula(s) com status suspenso. A causa não está registrada de forma estruturada.`,
      value: pack.academic.suspensions,
      period: pack.academic.periodLabel,
      impact: "Estoque atual. Não afirma que a suspensão tenha sido causada por três faltas.",
      suggestedDecision: "Priorizar o acompanhamento operacional das matrículas suspensas antes da próxima aula.",
      href: "/diretor/academico",
      source: "cadastro de matrículas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  if (pack.academic && pack.academic.attendanceReliable && pack.academic.streakThree > 0) {
    out.push({
      id: "acad-streak-three",
      ruleId: "acad.streak_three",
      ruleVersion: v,
      domain: "academic",
      severity: "critical",
      title: "Três faltas consecutivas identificadas",
      fact: `${pack.academic.streakThree} matrícula(s) com três faltas consecutivas sem justificativa na chamada.`,
      value: pack.academic.streakThree,
      period: pack.academic.periodLabel,
      impact: "Evidência de frequência, independente do status cadastral.",
      suggestedDecision:
        "Priorizar o acompanhamento antes da próxima aula, pois uma nova falta poderá cancelar a matrícula.",
      href: "/diretor/academico",
      source: "frequência nas aulas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  if (pack.academic && pack.academic.attendanceReliable && pack.academic.unprocessedFourAbsences > 0) {
    out.push({
      id: "acad-unprocessed-four",
      ruleId: "acad.unprocessed_four_absences",
      ruleVersion: v,
      domain: "academic",
      severity: "attention",
      title: "Cancelamento ainda não processado",
      fact: `${pack.academic.unprocessedFourAbsences} matrícula(s) com quatro faltas consecutivas sem justificativa ainda não canceladas.`,
      value: pack.academic.unprocessedFourAbsences,
      period: pack.academic.periodLabel,
      impact: "Inconsistência de processamento ou de qualidade dos dados.",
      suggestedDecision: "Pedir à coordenação a conferência do processamento automático de frequência.",
      href: "/diretor/academico",
      source: "frequência e status da matrícula",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  if (pack.academic && pack.academic.cancelled > 0) {
    out.push({
      id: "acad-cancellations-stock",
      ruleId: "acad.cancellations_stock",
      ruleVersion: v,
      domain: "academic",
      severity: "info",
      title: "Matrículas canceladas no recorte",
      fact: `${pack.academic.cancelledUnknownReason} cancelamento(s) sem motivo estruturado. ${CANCELLATION_PERIOD_UNAVAILABLE_REASON}`,
      value: pack.academic.cancelled,
      period: pack.academic.periodLabel,
      impact: "Estoque no recorte de turmas, não um fluxo datado do período.",
      suggestedDecision: "Acompanhar o estoque até existir histórico de status.",
      href: "/diretor/academico",
      source: "cadastro de matrículas",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  if (pack.academic && pack.academic.attendanceReliable && pack.academic.cancelledInferredAfterFour > 0) {
    out.push({
      id: "acad-cancellations-inferred-four",
      ruleId: "acad.cancellations_inferred_four",
      ruleVersion: v,
      domain: "academic",
      severity: "info",
      title: "Cancelamento após sequência de faltas",
      fact: `${pack.academic.cancelledInferredAfterFour} caso(s). ${INFERRED_ABSENCE_CANCELLATION_COPY}`,
      value: pack.academic.cancelledInferredAfterFour,
      period: pack.academic.periodLabel,
      impact: "Inferência pela chamada; não é motivo estruturado.",
      suggestedDecision: "Não tratar como causa estruturada até o histórico da Fase 2A.",
      href: "/diretor/academico",
      source: "frequência e status da matrícula",
      status: "Acompanhamento operacional ainda não registrado.",
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
      status: "Acompanhamento operacional ainda não registrado.",
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
      status: "Acompanhamento operacional ainda não registrado.",
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
      status: "Acompanhamento operacional ainda não registrado.",
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
      status: "Acompanhamento operacional ainda não registrado.",
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
      source: "Doações registradas no ano e meta anual",
      status: "Acompanhamento operacional ainda não registrado.",
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
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  return collectDirectorAlerts([out]);
}
