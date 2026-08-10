import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  getOrCreateDonorInstitutionSettings,
  serializeDonorInstitution,
} from "@/lib/donor-institution";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateDonorInstitutionSchema } from "@/lib/validators/donor-institution";

export async function GET() {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const settings = await getOrCreateDonorInstitutionSettings(actor.id);
  return jsonOk({ settings: serializeDonorInstitution(settings) });
}

export async function PUT(request: Request) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateDonorInstitutionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const current = await getOrCreateDonorInstitutionSettings(actor.id);
  const settings = await prisma.donorInstitutionSettings.update({
    where: { id: current.id },
    data: {
      ...parsed.data,
      updatedByUserId: actor.id,
    },
  });

  await createAuditLog({
    entityType: "DonorInstitutionSettings",
    entityId: settings.id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({ settings: serializeDonorInstitution(settings) });
}
