import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPoloSchema } from "@/lib/validators/polos";
import { createAuditLog } from "@/lib/audit";

const poloInclude = {
  coordinator: { select: { id: true, name: true, email: true, role: true } },
  locations: {
    orderBy: { name: "asc" as const },
    select: {
      id: true,
      name: true,
      address: true,
      isActive: true,
      _count: { select: { classGroups: true } },
    },
  },
  _count: { select: { locations: true } },
} as const;

/** Lista polos (Admin/Master/Coordenador). */
export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);

  const polos = await prisma.polo.findMany({
    orderBy: { name: "asc" },
    include: poloInclude,
  });

  return jsonOk({
    polos: polos.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      coordinatorUserId: p.coordinatorUserId,
      coordinator: p.coordinator,
      locations: p.locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        isActive: l.isActive,
        classGroupsCount: l._count.classGroups,
      })),
      locationsCount: p._count.locations,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  });
}

/** Cria polo com coordenador e opcionalmente locais. */
export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);

  const body = await request.json().catch(() => null);
  const parsed = createPoloSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { name, coordinatorUserId, isActive = true, locations = [] } = parsed.data;

  const coordinator = await prisma.user.findFirst({
    where: { id: coordinatorUserId, role: "POLO_COORDINATOR", isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!coordinator) {
    return jsonErr(
      "VALIDATION_ERROR",
      "O coordenador deve ser um usuário ativo com perfil Coordenador de Polos.",
      400,
    );
  }

  const names = locations.map((l) => l.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    return jsonErr("VALIDATION_ERROR", "Há locais com o mesmo nome neste polo.", 400);
  }

  const created = await prisma.polo.create({
    data: {
      name: name.trim(),
      coordinatorUserId,
      isActive,
      locations: {
        create: locations.map((l) => ({
          name: l.name.trim(),
          address: l.address?.trim() ? l.address.trim() : null,
          isActive: l.isActive ?? true,
        })),
      },
    },
    include: poloInclude,
  });

  await createAuditLog({
    entityType: "Polo",
    entityId: created.id,
    action: "CREATE",
    diff: { after: { id: created.id, name: created.name, coordinatorUserId } },
    performedByUserId: user.id,
  });

  return jsonOk(
    {
      polo: {
        id: created.id,
        name: created.name,
        isActive: created.isActive,
        coordinatorUserId: created.coordinatorUserId,
        coordinator: created.coordinator,
        locations: created.locations.map((l) => ({
          id: l.id,
          name: l.name,
          address: l.address,
          isActive: l.isActive,
          classGroupsCount: l._count.classGroups,
        })),
        locationsCount: created._count.locations,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    },
    { status: 201 },
  );
}
