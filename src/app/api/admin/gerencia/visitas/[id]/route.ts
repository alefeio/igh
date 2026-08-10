import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  serializeTechnicalVisit,
  technicalVisitInclude,
} from "@/lib/technical-visits";
import { updateTechnicalVisitSchema } from "@/lib/validators/equipment-visits";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const visit = await prisma.technicalVisit.findFirst({
    where: { id, deletedAt: null },
    include: technicalVisitInclude,
  });
  if (!visit) return jsonErr("NOT_FOUND", "Visita não encontrada.", 404);
  return jsonOk({ visit: serializeTechnicalVisit(visit) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.technicalVisit.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Visita não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateTechnicalVisitSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { checklistItems, ...rest } = parsed.data;

  const visit = await prisma.$transaction(async (tx) => {
    if (checklistItems) {
      await tx.technicalVisitChecklistItem.deleteMany({ where: { visitId: id } });
      await tx.technicalVisitChecklistItem.createMany({
        data: checklistItems.map((item, index) => ({
          visitId: id,
          key: item.key,
          label: item.label,
          standard: item.standard,
          status: item.status,
          observation: item.observation ?? null,
          sortOrder: item.sortOrder ?? index,
        })),
      });
    }

    return tx.technicalVisit.update({
      where: { id },
      data: {
        ...rest,
        address: rest.address === undefined ? undefined : rest.address,
      },
      include: technicalVisitInclude,
    });
  });

  await createAuditLog({
    entityType: "TechnicalVisit",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({ visit: serializeTechnicalVisit(visit) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.technicalVisit.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, locationName: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Visita não encontrada.", 404);

  await prisma.technicalVisit.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await createAuditLog({
    entityType: "TechnicalVisit",
    entityId: id,
    action: "ARCHIVE",
    diff: { locationName: existing.locationName },
    performedByUserId: actor.id,
  });
  return jsonOk({ archived: true });
}
