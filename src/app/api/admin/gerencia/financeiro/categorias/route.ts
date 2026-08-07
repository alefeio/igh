import { Prisma } from "@/generated/prisma/client";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  createFinancialCategorySchema,
} from "@/lib/validators/financeiro";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const activeOnly = new URL(request.url).searchParams.get("activeOnly") === "true";
  const categories = await prisma.financialCategory.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  return jsonOk({
    categories: categories.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
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
  const parsed = createFinancialCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const category = await prisma.financialCategory.create({
      data: { ...parsed.data, createdByUserId: actor.id },
    });
    await createAuditLog({
      entityType: "FinancialCategory",
      entityId: category.id,
      action: "CREATE",
      diff: { name: category.name, kind: category.kind },
      performedByUserId: actor.id,
    });
    return jsonOk(
      {
        category: {
          ...category,
          createdAt: category.createdAt.toISOString(),
          updatedAt: category.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe uma categoria com este nome para este tipo.", 409);
    }
    throw e;
  }
}
