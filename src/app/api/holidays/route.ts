import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createHolidaySchema } from "@/lib/validators/holidays";
import { createAuditLog } from "@/lib/audit";
import { recalculateAllClassGroupSessionsAfterHolidayChange } from "@/lib/class-sessions-holiday-resync";
import { SENTINEL_YEAR_RECURRING } from "@/lib/schedule";

export async function GET(request: Request) {
  await requireRole("MASTER");

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly");
  const where =
    activeOnly === "true" ? { isActive: true } : {};

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: { date: "asc" },
  });

  return jsonOk({ holidays });
}

export async function POST(request: Request) {
  const user = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createHolidaySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const recurring = parsed.data.recurring ?? false;
  const parsedDate = new Date(parsed.data.date + "T12:00:00.000Z");
  const date = recurring
    ? new Date(Date.UTC(SENTINEL_YEAR_RECURRING, parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
    : parsedDate;

  const existing = await prisma.holiday.findFirst({
    where: { date, recurring },
    select: { id: true },
  });
  if (existing) {
    return jsonErr(
      "DUPLICATE_DATE",
      recurring ? "Já existe um feriado recorrente para este dia e mês." : "Já existe um feriado para esta data.",
      409
    );
  }

  const holiday = await prisma.holiday.create({
    data: {
      date,
      recurring,
      name: parsed.data.name || null,
      isActive: parsed.data.isActive ?? true,
    },
  });

  await createAuditLog({
    entityType: "Holiday",
    entityId: holiday.id,
    action: "CREATE",
    diff: { after: holiday },
    performedByUserId: user.id,
  });

  let scheduleRecalculation: { classGroupsProcessed: number; classGroupsUpdated: number } | null = null;
  if (holiday.isActive) {
    scheduleRecalculation = await recalculateAllClassGroupSessionsAfterHolidayChange();
  }

  return jsonOk({ holiday, scheduleRecalculation }, { status: 201 });
}
