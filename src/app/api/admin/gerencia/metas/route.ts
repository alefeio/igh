import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { upsertAnnualGoalSchema } from "@/lib/validators/goals-agreements";

async function computersDoneForYear(year: number) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const donations = await prisma.donation.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMADA",
      donatedAt: { gte: from, lte: to },
    },
    select: { kitsCount: true, items: { select: { quantity: true } } },
  });
  return donations.reduce((sum, d) => {
    if (d.kitsCount > 0) return sum + d.kitsCount;
    return sum + d.items.reduce((s, i) => s + i.quantity, 0);
  }, 0);
}

export async function GET() {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const currentYear = new Date().getFullYear();
  const goals = await prisma.annualGoal.findMany({ orderBy: { year: "desc" } });
  const years = new Set(goals.map((g) => g.year));
  if (!years.has(currentYear)) years.add(currentYear);

  const withProgress = await Promise.all(
    Array.from(years)
      .sort((a, b) => b - a)
      .map(async (year) => {
        const goal = goals.find((g) => g.year === year) ?? null;
        const computersDone = await computersDoneForYear(year);
        return {
          id: goal?.id ?? null,
          year,
          computersTarget: goal?.computersTarget ?? 0,
          peopleTarget: goal?.peopleTarget ?? 0,
          notes: goal?.notes ?? null,
          computersDone,
          createdAt: goal?.createdAt.toISOString() ?? null,
          updatedAt: goal?.updatedAt.toISOString() ?? null,
        };
      }),
  );

  return jsonOk({ goals: withProgress });
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
  const parsed = upsertAnnualGoalSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const goal = await prisma.annualGoal.upsert({
    where: { year: parsed.data.year },
    create: {
      year: parsed.data.year,
      computersTarget: parsed.data.computersTarget,
      peopleTarget: parsed.data.peopleTarget,
      notes: parsed.data.notes ?? null,
      createdByUserId: actor.id,
    },
    update: {
      computersTarget: parsed.data.computersTarget,
      peopleTarget: parsed.data.peopleTarget,
      notes: parsed.data.notes ?? null,
    },
  });

  await createAuditLog({
    entityType: "AnnualGoal",
    entityId: goal.id,
    action: "UPSERT",
    diff: parsed.data,
    performedByUserId: actor.id,
  });

  return jsonOk({
    goal: {
      id: goal.id,
      year: goal.year,
      computersTarget: goal.computersTarget,
      peopleTarget: goal.peopleTarget,
      notes: goal.notes,
      computersDone: await computersDoneForYear(goal.year),
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    },
  });
}
