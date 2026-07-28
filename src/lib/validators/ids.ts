import { z } from "zod";

import { DEFAULT_CYCLE_ID } from "@/lib/cycles";

/**
 * Zod 4 exige UUID RFC (versão 1–8 + variante). O ciclo seed usa
 * `00000000-0000-0000-0000-000000000001`, que o Postgres/Prisma aceitam
 * mas o `.uuid()` do Zod 4 rejeita — daí o "Invalid UUID" ao criar turma.
 */
const UUID_RE =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

export function isAppUuid(value: string): boolean {
  return value === DEFAULT_CYCLE_ID || UUID_RE.test(value);
}

/** UUID de entidade (inclui o ID fixo do ciclo padrão). */
export const appUuid = z.string().refine(isAppUuid, { message: "ID inválido." });

/** UUID opcional: string vazia / null → undefined. */
export const optionalAppUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  appUuid.optional(),
);

/** UUID nullable: string vazia → null. */
export const nullableAppUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  appUuid.nullable(),
);
