import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serializeDonorInstitution, setDefaultDonorInstitution } from "@/lib/donor-institution";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateDonorInstitutionSchema } from "@/lib/validators/donor-institution";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.donorInstitutionSettings.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Doadora não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateDonorInstitutionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { isDefault, ...fields } = parsed.data;
  await prisma.donorInstitutionSettings.update({
    where: { id },
    data: {
      ...fields,
      updatedByUserId: actor.id,
    },
  });

  if (isDefault) {
    await setDefaultDonorInstitution(id, actor.id);
  } else if (isDefault === false) {
    await prisma.donorInstitutionSettings.update({
      where: { id },
      data: { isDefault: false, updatedByUserId: actor.id },
    });
  }

  const saved = await prisma.donorInstitutionSettings.findFirstOrThrow({
    where: { id },
    include: { _count: { select: { donations: true } } },
  });

  await createAuditLog({
    entityType: "DonorInstitutionSettings",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({ institution: serializeDonorInstitution(saved) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.donorInstitutionSettings.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, isDefault: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Doadora não encontrada.", 404);

  const remaining = await prisma.donorInstitutionSettings.count({
    where: { deletedAt: null, id: { not: id } },
  });
  if (remaining === 0) {
    return jsonErr(
      "INVALID_STATE",
      "Cadastre outra doadora antes de arquivar a última instituição.",
      400,
    );
  }

  await prisma.donorInstitutionSettings.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, isDefault: false, updatedByUserId: actor.id },
  });

  if (existing.isDefault) {
    const next = await prisma.donorInstitutionSettings.findFirst({
      where: { deletedAt: null, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (next) await setDefaultDonorInstitution(next.id, actor.id);
  }

  await createAuditLog({
    entityType: "DonorInstitutionSettings",
    entityId: id,
    action: "ARCHIVE",
    diff: { name: existing.name },
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
