import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updatePoloSchema } from "@/lib/validators/polos";
import { createAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

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

function mapPolo(p: {
  id: string;
  name: string;
  isActive: boolean;
  coordinatorUserId: string;
  createdAt: Date;
  updatedAt: Date;
  coordinator: { id: string; name: string; email: string; role: string };
  locations: Array<{
    id: string;
    name: string;
    address: string | null;
    isActive: boolean;
    _count: { classGroups: number };
  }>;
  _count: { locations: number };
}) {
  return {
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
  };
}

export async function GET(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const polo = await prisma.polo.findUnique({
    where: { id },
    include: poloInclude,
  });
  if (!polo) return jsonErr("NOT_FOUND", "Polo não encontrado.", 404);

  return jsonOk({ polo: mapPolo(polo) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const existing = await prisma.polo.findUnique({
    where: { id },
    include: { locations: { select: { id: true } } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Polo não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updatePoloSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  if (parsed.data.coordinatorUserId) {
    const coordinator = await prisma.user.findFirst({
      where: { id: parsed.data.coordinatorUserId, role: "POLO_COORDINATOR", isActive: true },
      select: { id: true },
    });
    if (!coordinator) {
      return jsonErr(
        "VALIDATION_ERROR",
        "O coordenador deve ser um usuário ativo com perfil Coordenador de Polos.",
        400,
      );
    }
  }

  if (parsed.data.locations) {
    const names = parsed.data.locations.map((l) => l.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      return jsonErr("VALIDATION_ERROR", "Há locais com o mesmo nome neste polo.", 400);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (
      parsed.data.name !== undefined ||
      parsed.data.coordinatorUserId !== undefined ||
      parsed.data.isActive !== undefined
    ) {
      await tx.polo.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.coordinatorUserId !== undefined
            ? { coordinatorUserId: parsed.data.coordinatorUserId }
            : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
      });
    }

    if (parsed.data.locations) {
      const incoming = parsed.data.locations;
      const keepIds = new Set(incoming.filter((l) => l.id).map((l) => l.id!));
      const existingIds = existing.locations.map((l) => l.id);

      for (const locId of existingIds) {
        if (!keepIds.has(locId)) {
          await tx.poloLocation.update({
            where: { id: locId },
            data: { isActive: false },
          });
        }
      }

      for (const loc of incoming) {
        if (loc.id && existingIds.includes(loc.id)) {
          await tx.poloLocation.update({
            where: { id: loc.id },
            data: {
              name: loc.name.trim(),
              address: loc.address?.trim() ? loc.address.trim() : null,
              isActive: loc.isActive ?? true,
            },
          });
        } else {
          await tx.poloLocation.create({
            data: {
              poloId: id,
              name: loc.name.trim(),
              address: loc.address?.trim() ? loc.address.trim() : null,
              isActive: loc.isActive ?? true,
            },
          });
        }
      }
    }

    return tx.polo.findUniqueOrThrow({
      where: { id },
      include: poloInclude,
    });
  });

  await createAuditLog({
    entityType: "Polo",
    entityId: id,
    action: "UPDATE",
    diff: { after: { name: updated.name, coordinatorUserId: updated.coordinatorUserId } },
    performedByUserId: user.id,
  });

  return jsonOk({ polo: mapPolo(updated) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const existing = await prisma.polo.findUnique({
    where: { id },
    include: {
      locations: { select: { id: true, _count: { select: { classGroups: true } } } },
    },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Polo não encontrado.", 404);

  const linkedTurmas = existing.locations.reduce((s, l) => s + l._count.classGroups, 0);
  if (linkedTurmas > 0) {
    return jsonErr(
      "INVALID_STATE",
      `Não é possível excluir: há ${linkedTurmas} turma(s) vinculada(s) a locais deste polo. Desative o polo ou desvincule as turmas.`,
      400,
    );
  }

  await prisma.polo.delete({ where: { id } });

  await createAuditLog({
    entityType: "Polo",
    entityId: id,
    action: "DELETE",
    diff: { before: { id, name: existing.name } },
    performedByUserId: user.id,
  });

  return jsonOk({ deleted: true });
}
