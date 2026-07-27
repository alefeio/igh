import type { Prisma } from "@/generated/prisma/client";

/**
 * Resolve o parâmetro `cycles` das listagens de alunos.
 *
 * - ausente ou `all`: sem recorte por ciclo — é o padrão, para que qualquer tela que
 *   consuma a listagem continue enxergando toda a base
 * - `none`: nenhum ciclo marcado na tela
 * - lista de ids separados por vírgula: exatamente esses ciclos
 *
 * Quem quiser abrir no ciclo atual manda os ids explicitamente; a tela de Alunos faz isso.
 * Retorna `null` quando não há recorte a aplicar e uma lista vazia quando nada deve casar.
 */
export function resolveCycleIdsParam(raw: string | null | undefined): string[] | null {
  const value = raw?.trim() ?? "";
  if (value === "" || value === "all") return null;
  if (value === "none") return [];

  const ids = value.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : [];
}

/** Recorte por matrícula ativa nos ciclos escolhidos, para compor o `where` de aluno. */
export function activeEnrollmentInCycles(cycleIds: string[]): Prisma.StudentWhereInput {
  return { enrollments: { some: { status: "ACTIVE", classGroup: { cycleId: { in: cycleIds } } } } };
}
