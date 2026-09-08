import { createAuditLog } from "@/lib/audit";
import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateHolidayEventRaffleSchema } from "@/lib/validators/holiday-event-raffle";

type RouteCtx = { params: Promise<{ id: string; raffleId: string }> };

function authFailure(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
  return jsonErr("FORBIDDEN", "Acesso negado.", 403);
}

export async function PATCH(request: Request, context: RouteCtx) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch (e) {
    return authFailure(e);
  }

  const { id, raffleId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateHolidayEventRaffleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const existing = await prisma.holidayEventRaffle.findFirst({
    where: { id: raffleId, holidayId: id },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Sorteio não encontrado.", 404);

  const raffle = await prisma.holidayEventRaffle.update({
    where: { id: raffleId },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.prize !== undefined ? { prize: parsed.data.prize?.trim() || null } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description?.trim() || null }
        : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
      ...(parsed.data.allowRepeatWinner !== undefined
        ? { allowRepeatWinner: parsed.data.allowRepeatWinner }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
  });

  await createAuditLog({
    entityType: "HolidayEventRaffle",
    entityId: raffleId,
    action: "UPDATE",
    diff: { before: existing, after: raffle },
    performedByUserId: user.id,
  });

  return jsonOk({ raffle });
}

export async function DELETE(_request: Request, context: RouteCtx) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch (e) {
    return authFailure(e);
  }

  const { id, raffleId } = await context.params;
  const existing = await prisma.holidayEventRaffle.findFirst({
    where: { id: raffleId, holidayId: id },
    select: { id: true, title: true, occurrenceDate: true, _count: { select: { draws: true } } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Sorteio não encontrado.", 404);

  if (existing._count.draws > 0) {
    return jsonErr(
      "VALIDATION_ERROR",
      "Este sorteio já foi realizado. Cancele-o em vez de excluir, para preservar o histórico.",
      400,
    );
  }

  await prisma.holidayEventRaffle.delete({ where: { id: raffleId } });

  await createAuditLog({
    entityType: "HolidayEventRaffle",
    entityId: raffleId,
    action: "DELETE",
    diff: { before: existing },
    performedByUserId: user.id,
  });

  return jsonOk({ deleted: true });
}
