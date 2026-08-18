import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  getOrCreateDonorInstitutionSettings,
  listDonorInstitutions,
  serializeDonorInstitution,
  setDefaultDonorInstitution,
} from "@/lib/donor-institution";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createDonorInstitutionSchema } from "@/lib/validators/donor-institution";

export async function GET() {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const institutions = await listDonorInstitutions();
  return jsonOk({
    institutions: institutions.map(serializeDonorInstitution),
    settings: serializeDonorInstitution(
      institutions.find((i) => i.isDefault) ?? institutions[0] ?? (await getOrCreateDonorInstitutionSettings()),
    ),
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
  const parsed = createDonorInstitutionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  const created = await prisma.donorInstitutionSettings.create({
    data: {
      name: data.name,
      document: data.document ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      cep: data.cep ?? null,
      phone: data.phone ?? null,
      representativeName: data.representativeName ?? null,
      representativeRole: data.representativeRole ?? null,
      representativeCpf: data.representativeCpf ?? null,
      isActive: data.isActive ?? true,
      isDefault: false,
      updatedByUserId: actor.id,
    },
  });

  if (data.isDefault) {
    await setDefaultDonorInstitution(created.id, actor.id);
  }

  const saved = await prisma.donorInstitutionSettings.findFirstOrThrow({
    where: { id: created.id },
    include: { _count: { select: { donations: true } } },
  });

  await createAuditLog({
    entityType: "DonorInstitutionSettings",
    entityId: saved.id,
    action: "CREATE",
    diff: { name: saved.name, isDefault: saved.isDefault },
    performedByUserId: actor.id,
  });

  return jsonOk({ institution: serializeDonorInstitution(saved) }, { status: 201 });
}
