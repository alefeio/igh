import { requireStaffRead, requireStaffWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { listRafflesForOccurrence } from "@/lib/holiday-event-raffle";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createHolidayEventRaffleSchema } from "@/lib/validators/holiday-event-raffle";

function authFailure(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
  return jsonErr("FORBIDDEN", "Acesso negado.", 403);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffRead();
  } catch (e) {
    return authFailure(e);
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const occurrenceDate = searchParams.get("occurrenceDate")?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    return jsonErr("VALIDATION_ERROR", "Informe a data da ocorrência.", 400);
  }

  const raffles = await listRafflesForOccurrence(id, occurrenceDate);
  return jsonOk({ raffles });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch (e) {
    return authFailure(e);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = createHolidayEventRaffleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const holiday = await prisma.holiday.findFirst({
    where: {
      id,
      allowsRegistration: true,
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
    select: { id: true },
  });
  if (!holiday) {
    return jsonErr("NOT_FOUND", "Sorteios só podem ser cadastrados em eventos com inscrição.", 404);
  }

  const nextOrder =
    parsed.data.order ??
    (await prisma.holidayEventRaffle
      .findFirst({
        where: { holidayId: id, occurrenceDate: parsed.data.occurrenceDate },
        orderBy: { order: "desc" },
        select: { order: true },
      })
      .then((r) => (r ? r.order + 1 : 0)));

  const raffle = await prisma.holidayEventRaffle.create({
    data: {
      holidayId: id,
      occurrenceDate: parsed.data.occurrenceDate,
      title: parsed.data.title,
      prize: parsed.data.prize?.trim() || null,
      description: parsed.data.description?.trim() || null,
      order: nextOrder,
      allowRepeatWinner: parsed.data.allowRepeatWinner ?? false,
    },
  });

  await createAuditLog({
    entityType: "HolidayEventRaffle",
    entityId: raffle.id,
    action: "CREATE",
    diff: { after: raffle },
    performedByUserId: user.id,
  });

  return jsonOk({ raffle }, { status: 201 });
}
