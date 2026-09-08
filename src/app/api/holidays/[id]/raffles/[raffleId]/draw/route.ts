import { requireStaffWrite } from "@/lib/auth";
import { drawRaffle } from "@/lib/holiday-event-raffle";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { drawHolidayEventRaffleSchema } from "@/lib/validators/holiday-event-raffle";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; raffleId: string }> },
) {
  let user;
  try {
    user = await requireStaffWrite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { id, raffleId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = drawHolidayEventRaffleSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const belongs = await prisma.holidayEventRaffle.findFirst({
    where: { id: raffleId, holidayId: id },
    select: { id: true },
  });
  if (!belongs) return jsonErr("NOT_FOUND", "Sorteio não encontrado.", 404);

  const result = await drawRaffle({
    raffleId,
    performedByUserId: user.id,
    redraw: parsed.data.redraw ?? false,
  });
  if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);

  return jsonOk({ winner: result.winner, redrawn: result.redrawn });
}
