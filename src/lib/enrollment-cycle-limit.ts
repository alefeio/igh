import "server-only";

import { prisma } from "@/lib/prisma";

/** Máximo de matrículas ACTIVE por aluno no mesmo ciclo (inscrição pública). */
export const MAX_ACTIVE_ENROLLMENTS_PER_CYCLE = 2;

/**
 * Conta matrículas ACTIVE do aluno em turmas do ciclo informado.
 * CANCELLED e demais status não entram.
 */
export async function countActiveEnrollmentsInCycle(
  studentId: string,
  cycleId: string,
): Promise<number> {
  return prisma.enrollment.count({
    where: {
      studentId,
      status: "ACTIVE",
      classGroup: { cycleId },
    },
  });
}

/**
 * Bloqueia se o aluno já atingiu o teto de matrículas ACTIVE no ciclo da turma.
 */
export async function assertPublicCycleEnrollmentLimit(args: {
  studentId: string;
  cycleId: string;
}): Promise<{ ok: true; count: number } | { ok: false; code: string; message: string; status: number; count: number }> {
  const count = await countActiveEnrollmentsInCycle(args.studentId, args.cycleId);
  if (count >= MAX_ACTIVE_ENROLLMENTS_PER_CYCLE) {
    return {
      ok: false,
      code: "LIMIT_EXCEEDED",
      message:
        "Você já está inscrito em 2 turmas neste ciclo. Não é possível se inscrever em outra turma. Entre em contato com a secretaria se precisar de ajuda.",
      status: 400,
      count,
    };
  }
  return { ok: true, count };
}
