import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { registerUserForHolidayEvent } from "@/lib/holiday-event-registration";
import { jsonErr, jsonOk } from "@/lib/http";
import { registerHolidayEventSchema } from "@/lib/validators/holiday-event-registration";

type RouteCtx = { params: Promise<{ holidayId: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["STUDENT", "TEACHER", "ADMIN", "MASTER", "COORDINATOR"]);
    if (!user.isActive) return jsonErr("FORBIDDEN", "Conta inativa.", 403);

    const { holidayId } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = registerHolidayEventSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    const result = await registerUserForHolidayEvent({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      holidayId,
      occurrenceDate: parsed.data.occurrenceDate,
    });

    if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);

    return jsonOk(
      {
        registrationId: result.registration.id,
        alreadyRegistered: result.alreadyRegistered,
        message: result.alreadyRegistered
          ? "Você já está inscrito neste evento."
          : "Inscrição confirmada! Enviamos um e-mail com os detalhes.",
      },
      { status: result.alreadyRegistered ? 200 : 201 }
    );
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
