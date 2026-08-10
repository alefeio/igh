import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createDonatariaSchema } from "@/lib/validators/inventory-donations";

export async function GET() {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const donatarias = await prisma.donataria.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { donations: true } } },
  });

  return jsonOk({
    donatarias: donatarias.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
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
  const parsed = createDonatariaSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const donataria = await prisma.donataria.create({
    data: { ...parsed.data, createdByUserId: actor.id },
  });

  await createAuditLog({
    entityType: "Donataria",
    entityId: donataria.id,
    action: "CREATE",
    diff: { name: donataria.name },
    performedByUserId: actor.id,
  });

  return jsonOk(
    {
      donataria: {
        ...donataria,
        createdAt: donataria.createdAt.toISOString(),
        updatedAt: donataria.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
