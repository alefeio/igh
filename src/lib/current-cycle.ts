import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Ciclo atual: o mais recente cadastrado (maior ano e, dentro dele, maior número).
 *
 * Não usamos `isVisibleForEnrollments` porque essa flag marca o ciclo aberto para
 * inscrições, que pode ser o próximo — e não o que está em andamento.
 */
export async function getCurrentCycleId(): Promise<string | null> {
  const current = await prisma.cycle.findFirst({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: { id: true },
  });
  return current?.id ?? null;
}

/**
 * Resolve o parâmetro `cycles` das listagens.
 *
 * - ausente: ciclo atual (padrão das telas)
 * - `all`: sem recorte por ciclo
 * - `none`: nenhum ciclo marcado na tela
 * - lista de ids separados por vírgula: exatamente esses ciclos
 *
 * Retorna `null` quando não há recorte a aplicar e uma lista vazia quando nada deve casar.
 */
export async function resolveCycleIdsParam(raw: string | null): Promise<string[] | null> {
  const value = raw?.trim() ?? "";
  if (value === "all") return null;
  if (value === "none") return [];

  if (value.length > 0) {
    const ids = value.split(",").map((s) => s.trim()).filter(Boolean);
    return ids.length > 0 ? ids : [];
  }

  const currentId = await getCurrentCycleId();
  return currentId ? [currentId] : null;
}
