import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  serializeTechnicalVisit,
  technicalVisitInclude,
} from "@/lib/technical-visits";
import { createTechnicalVisitSchema } from "@/lib/validators/equipment-visits";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  const visits = await prisma.technicalVisit.findMany({
    where: { deletedAt: null },
    orderBy: [{ visitedAt: "desc" }, { createdAt: "desc" }],
    include: technicalVisitInclude,
  });

  const mapped = visits.map(serializeTechnicalVisit);
  const filtered = q
    ? mapped.filter((v) => {
        const hay = `${v.locationName} ${v.municipality} ${v.localContact ?? ""} ${v.donataria?.name ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
    : mapped;

  const aptas = filtered.filter((v) => v.finalClassification === "APTA").length;
  const comPendencias = filtered.filter(
    (v) => v.finalClassification === "APTA_COM_PENDENCIAS" || v.pendingCount > 0,
  ).length;

  return jsonOk({
    visits: filtered,
    totals: {
      registered: filtered.length,
      aptas,
      withPending: comPendencias,
    },
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createTechnicalVisitSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;

  if (data.donatariaId) {
    const donataria = await prisma.donataria.findFirst({
      where: { id: data.donatariaId, deletedAt: null },
      select: { id: true },
    });
    if (!donataria) return jsonErr("NOT_FOUND", "Donatária não encontrada.", 404);
  }

  const visit = await prisma.technicalVisit.create({
    data: {
      locationName: data.locationName,
      municipality: data.municipality,
      state: data.state,
      address: data.address ?? null,
      localContact: data.localContact ?? null,
      visitedAt: data.visitedAt,
      visitors: data.visitors ?? null,
      metaStudents: data.metaStudents ?? null,
      metaClassGroups: data.metaClassGroups ?? null,
      metaStudentsPerClass: data.metaStudentsPerClass ?? null,
      classDuration: data.classDuration ?? null,
      classesPerWeek: data.classesPerWeek ?? null,
      classDays: data.classDays ?? null,
      pedagogicalPlan: data.pedagogicalPlan ?? null,
      structuralStandards: data.structuralStandards ?? null,
      finalClassification: data.finalClassification,
      finalNotes: data.finalNotes ?? null,
      donatariaId: data.donatariaId ?? null,
      createdByUserId: actor.id,
      checklistItems: {
        create: data.checklistItems.map((item, index) => ({
          key: item.key,
          label: item.label,
          standard: item.standard,
          status: item.status,
          observation: item.observation ?? null,
          sortOrder: item.sortOrder ?? index,
        })),
      },
    },
    include: technicalVisitInclude,
  });

  await createAuditLog({
    entityType: "TechnicalVisit",
    entityId: visit.id,
    action: "CREATE",
    diff: {
      locationName: visit.locationName,
      municipality: visit.municipality,
      finalClassification: visit.finalClassification,
    },
    performedByUserId: actor.id,
  });

  return jsonOk({ visit: serializeTechnicalVisit(visit) }, { status: 201 });
}
