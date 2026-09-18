import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { applyClassGroupAutomaticStatusUpdatesCached } from "@/lib/class-group-auto-status";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";

/** Turmas inscrevíveis pelo público (site /inscreva), inclusive já em andamento. */
export const PUBLIC_INSCREVA_STATUSES = ["PLANEJADA", "ABERTA", "EM_ANDAMENTO"] as const;

/** Data de hoje em UTC (somente dia), para comparar com `enrollmentDeadlineDate`. */
export function todayDateOnlyUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** True se não há prazo ou se hoje ainda está no prazo (inclusive). */
export function isWithinEnrollmentDeadline(deadline: Date | null | undefined): boolean {
  if (deadline == null) return true;
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(d.getTime())) return true;
  const deadlineUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return todayDateOnlyUtc().getTime() <= deadlineUtc;
}

/**
 * Filtro das turmas que aparecem em /inscreva. Mantido em um só lugar para que a listagem
 * pública e o aviso de "inscrições abertas" no painel do aluno nunca divirjam.
 * Exige ciclo visível e dentro da data limite de inscrição (se definida).
 */
export function publicInscrevaClassGroupWhere(): Prisma.ClassGroupWhereInput {
  const today = todayDateOnlyUtc();
  return {
    status: { in: [...PUBLIC_INSCREVA_STATUSES] },
    isExternal: false,
    course: { status: "ACTIVE" },
    cycle: {
      isVisibleForEnrollments: true,
      OR: [{ enrollmentDeadlineDate: null }, { enrollmentDeadlineDate: { gte: today } }],
    },
  };
}

/** Há ao menos um ciclo liberado para matrículas no site (`isVisibleForEnrollments`). */
export async function hasVisibleEnrollmentCycle(): Promise<boolean> {
  const today = todayDateOnlyUtc();
  const count = await prisma.cycle.count({
    where: {
      isVisibleForEnrollments: true,
      OR: [{ enrollmentDeadlineDate: null }, { enrollmentDeadlineDate: { gte: today } }],
    },
  });
  return count > 0;
}

export type CurrentCycleEnrollmentWindow = {
  id: string;
  cycle: number;
  year: number;
  isVisibleForEnrollments: boolean;
  enrollmentDeadlineDate: Date | null;
  /** Matrículas abertas no site: ciclo atual visível e dentro do prazo. */
  enrollmentsOpen: boolean;
};

/** Ciclo atual = último cadastrado (maior ano, depois maior número). */
export async function getCurrentCycleEnrollmentWindow(): Promise<CurrentCycleEnrollmentWindow | null> {
  const current = await prisma.cycle.findFirst({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: {
      id: true,
      cycle: true,
      year: true,
      isVisibleForEnrollments: true,
      enrollmentDeadlineDate: true,
    },
  });
  if (!current) return null;
  const enrollmentsOpen =
    current.isVisibleForEnrollments && isWithinEnrollmentDeadline(current.enrollmentDeadlineDate);
  return { ...current, enrollmentsOpen };
}

/**
 * Matrículas do site abertas no ciclo atual (visível + dentro da data limite).
 * Quando true, pré-inscrição / interesse no próximo ciclo deve ficar oculto.
 */
export async function areSiteEnrollmentsOpen(): Promise<boolean> {
  const window = await getCurrentCycleEnrollmentWindow();
  return window?.enrollmentsOpen === true;
}

/** Exibir CTAs/páginas de pré-inscrição (próximo ciclo) apenas quando as matrículas do ciclo atual não estão abertas. */
export async function shouldShowNextCycleInterest(): Promise<boolean> {
  return !(await areSiteEnrollmentsOpen());
}

/** Quantas turmas o público consegue escolher agora (já descontando as lotadas). */
export async function countOpenPublicClassGroups(): Promise<number> {
  await applyClassGroupAutomaticStatusUpdatesCached();
  const classGroups = await prisma.classGroup.findMany({
    where: publicInscrevaClassGroupWhere(),
    select: {
      capacity: true,
      _count: { select: { enrollments: { where: { status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } } } } },
    },
  });
  return classGroups.filter((cg) => cg._count.enrollments < cg.capacity).length;
}
