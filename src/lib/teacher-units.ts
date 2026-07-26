import "server-only";

import { prisma } from "@/lib/prisma";
import {
  classGroupPoloLabel,
  classGroupUnitGroupKey,
  classGroupUnitLabel,
} from "@/lib/class-group-unit";

/** Local de atuação exibido na listagem de professores. */
export type TeacherUnit = {
  /** Chave estável do agrupamento, usada como valor do filtro. */
  key: string;
  unitName: string;
  poloName: string | null;
};

/** Turmas canceladas não indicam atuação. */
const IGNORED_STATUSES = ["CANCELADA"] as const;

/**
 * Onde cada professor atua, derivado das turmas que leciona.
 *
 * O cadastro do professor não guarda polo nem unidade: essa informação vive na turma
 * (`PoloLocation` ou, nas turmas antigas, o texto livre `location`). Considera tanto o
 * professor titular quanto os adicionais, já que ambos atuam no local.
 */
export async function getUnitsByTeacherId(
  teacherIds: string[]
): Promise<Map<string, TeacherUnit[]>> {
  const result = new Map<string, TeacherUnit[]>();
  if (teacherIds.length === 0) return result;

  const classGroups = await prisma.classGroup.findMany({
    where: {
      status: { notIn: [...IGNORED_STATUSES] },
      OR: [
        { teacherId: { in: teacherIds } },
        { classGroupTeachers: { some: { teacherId: { in: teacherIds } } } },
      ],
    },
    select: {
      teacherId: true,
      location: true,
      poloLocation: {
        select: { id: true, name: true, polo: { select: { id: true, name: true } } },
      },
      classGroupTeachers: { select: { teacherId: true } },
    },
  });

  const wanted = new Set(teacherIds);
  /** Evita repetir a mesma unidade quando o professor tem várias turmas no local. */
  const seen = new Map<string, Set<string>>();

  for (const cg of classGroups) {
    const unit = cg.poloLocation
      ? {
          id: cg.poloLocation.id,
          name: cg.poloLocation.name,
          poloId: cg.poloLocation.polo.id,
          poloName: cg.poloLocation.polo.name,
        }
      : null;

    const entry: TeacherUnit = {
      key: classGroupUnitGroupKey(unit, cg.location),
      unitName: classGroupUnitLabel(unit, cg.location),
      poloName: classGroupPoloLabel(unit),
    };

    const involved = new Set<string>([cg.teacherId, ...cg.classGroupTeachers.map((t) => t.teacherId)]);
    for (const teacherId of involved) {
      if (!wanted.has(teacherId)) continue;
      const keys = seen.get(teacherId) ?? new Set<string>();
      if (keys.has(entry.key)) continue;
      keys.add(entry.key);
      seen.set(teacherId, keys);
      const list = result.get(teacherId) ?? [];
      list.push(entry);
      result.set(teacherId, list);
    }
  }

  for (const list of result.values()) {
    list.sort((a, b) => {
      const byPolo = (a.poloName ?? "").localeCompare(b.poloName ?? "", "pt-BR");
      if (byPolo !== 0) return byPolo;
      return a.unitName.localeCompare(b.unitName, "pt-BR");
    });
  }

  return result;
}
