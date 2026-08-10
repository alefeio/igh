import "server-only";

import type {
  TechnicalVisitClassification,
  TechnicalVisitItemStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const technicalVisitInclude = {
  donataria: { select: { id: true, name: true } },
  checklistItems: { orderBy: { sortOrder: "asc" as const } },
  createdByUser: { select: { id: true, name: true } },
} as const;

type VisitLoaded = Awaited<
  ReturnType<
    typeof prisma.technicalVisit.findFirstOrThrow<{ include: typeof technicalVisitInclude }>
  >
>;

export function serializeTechnicalVisit(v: VisitLoaded) {
  const okCount = v.checklistItems.filter((i) => i.status === "OK").length;
  const pendingCount = v.checklistItems.filter((i) => i.status === "PENDENTE").length;
  return {
    id: v.id,
    locationName: v.locationName,
    municipality: v.municipality,
    state: v.state,
    address: v.address,
    localContact: v.localContact,
    visitedAt: v.visitedAt.toISOString().slice(0, 10),
    visitors: v.visitors,
    metaStudents: v.metaStudents,
    metaClassGroups: v.metaClassGroups,
    metaStudentsPerClass: v.metaStudentsPerClass,
    classDuration: v.classDuration,
    classesPerWeek: v.classesPerWeek,
    classDays: v.classDays,
    pedagogicalPlan: v.pedagogicalPlan,
    structuralStandards: v.structuralStandards,
    finalClassification: v.finalClassification as TechnicalVisitClassification,
    finalNotes: v.finalNotes,
    donatariaId: v.donatariaId,
    donataria: v.donataria,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    createdByUser: v.createdByUser,
    checklistItems: v.checklistItems.map((i) => ({
      id: i.id,
      key: i.key,
      label: i.label,
      standard: i.standard,
      status: i.status as TechnicalVisitItemStatus,
      observation: i.observation,
      sortOrder: i.sortOrder,
    })),
    okCount,
    pendingCount,
    checklistTotal: v.checklistItems.length,
  };
}
