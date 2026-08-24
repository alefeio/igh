import "server-only";

import { FORMULA_VERSION_1B } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import { yearBounds } from "@/lib/diretor/period";
import type { ResponseMetaDto } from "@/lib/diretor/schemas/common";
import { prisma } from "@/lib/prisma";

export type ProjectsFilters = { year?: string; from?: string; to?: string };

export type ProjectsBundle = {
  meta: ResponseMetaDto;
  unavailablePortfolio: true;
  notice: string;
  futureModelNote: string;
  annualGoal: {
    year: number;
    computersTarget: number;
    peopleTarget: number;
    notes: string | null;
  } | null;
  visitsSummary: { count: number; apta: number; inapta: number; pendencias: number };
  donationsContext: { confirmedCount: number; kits: number };
  links: { social: string; financial: string };
  qualityNotes: string[];
};

async function loadProjectsUncached(
  filters: ProjectsFilters,
  viewer: "DIRECTOR" | "MASTER",
  asOf = new Date(),
): Promise<ProjectsBundle> {
  const year = filters.year ? Number(filters.year) : asOf.getUTCFullYear();
  const yb = yearBounds(Number.isFinite(year) ? year : asOf.getUTCFullYear());
  const goal = await prisma.annualGoal.findUnique({
    where: { year: Number.isFinite(year) ? year : asOf.getUTCFullYear() },
  });
  const visits = await prisma.technicalVisit.findMany({
    where: { deletedAt: null, visitedAt: { gte: yb.from, lte: yb.to } },
    select: { finalClassification: true },
  });
  const donations = await prisma.donation.findMany({
    where: { deletedAt: null, status: "CONFIRMADA", donatedAt: { gte: yb.from, lte: yb.to } },
    select: { kitsCount: true },
  });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: asOf.toISOString(),
      filters: { year: String(Number.isFinite(year) ? year : asOf.getUTCFullYear()) },
      quality: [{ domain: "projects", status: "unavailable", note: "Cadastro de projetos/convênios institucionais inexistente." }],
      formulaVersion: FORMULA_VERSION_1B,
      viewer,
    },
    unavailablePortfolio: true,
    notice:
      "O sistema ainda não possui cadastro estruturado de projetos e convênios institucionais. Vigência, financiador, metas, orçamento, responsáveis e prestação de contas serão disponibilizados após a implantação desse cadastro.",
    futureModelNote:
      "Estrutura futura prevista: InstitutionalProject e GrantAgreement (sem migration nesta fase). PaymentAgreement não é convênio de projeto.",
    annualGoal: goal
      ? {
          year: goal.year,
          computersTarget: goal.computersTarget,
          peopleTarget: goal.peopleTarget,
          notes: goal.notes,
        }
      : null,
    visitsSummary: {
      count: visits.length,
      apta: visits.filter((v) => v.finalClassification === "APTA").length,
      inapta: visits.filter((v) => v.finalClassification === "INAPTA").length,
      pendencias: visits.filter((v) => v.finalClassification === "APTA_COM_PENDENCIAS").length,
    },
    donationsContext: {
      confirmedCount: donations.length,
      kits: donations.reduce((a, d) => a + (d.kitsCount || 0), 0),
    },
    links: { social: "/diretor/impacto-social", financial: "/diretor/financeiro" },
    qualityNotes: ["Portfólio de projetos não modelado — nenhum zero exibido como se existisse cadastro."],
  };
}

export async function loadProjects(filters: ProjectsFilters, viewer: "DIRECTOR" | "MASTER") {
  return cachedDirector(["projects", filters.year, filters.from, filters.to, viewer], () =>
    loadProjectsUncached(filters, viewer),
  );
}

export async function summarizeProjects(filters: ProjectsFilters, viewer: "DIRECTOR" | "MASTER") {
  void viewer;
  return cachedDirector(["projects-summary", filters.year], async () => ({
    unavailable: true as const,
    year: filters.year ?? String(new Date().getUTCFullYear()),
    quality: [
      {
        domain: "projects",
        status: "unavailable" as const,
        note: "Cadastro de projetos/convênios institucionais inexistente.",
      },
    ],
    qualityNotes: ["Portfólio de projetos não modelado — nenhum zero exibido como quantidade real."],
  }));
}
