import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { applyClassGroupAutomaticStatusUpdatesCached } from "@/lib/class-group-auto-status";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";

/** Turmas inscrevíveis pelo público (site /inscreva), inclusive já em andamento. */
export const PUBLIC_INSCREVA_STATUSES = ["PLANEJADA", "ABERTA", "EM_ANDAMENTO"] as const;

/**
 * Filtro das turmas que aparecem em /inscreva. Mantido em um só lugar para que a listagem
 * pública e o aviso de "inscrições abertas" no painel do aluno nunca divirjam.
 */
export function publicInscrevaClassGroupWhere(): Prisma.ClassGroupWhereInput {
  return {
    status: { in: [...PUBLIC_INSCREVA_STATUSES] },
    isExternal: false,
    course: { status: "ACTIVE" },
    cycle: { isVisibleForEnrollments: true },
  };
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
