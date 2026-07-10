import {
  clientIpFromRequest,
  isHoneypotFilled,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "@/lib/bot-protection";
import { registerGuestForHolidayEvent } from "@/lib/holiday-event-registration";
import { jsonErr, jsonOk } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { guestHolidayEventRegisterSchema } from "@/lib/validators/holiday-event-registration";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 20;

export async function POST(
  request: Request,
  context: { params: Promise<{ holidayId: string }> },
) {
  try {
    const { holidayId } = await context.params;
    const body = await request.json().catch(() => null);
    if (isHoneypotFilled(body as Record<string, unknown> | null)) {
      return jsonOk({ registrationId: "ok", alreadyRegistered: false, message: "Inscrição registrada." });
    }

    const ip = clientIpFromRequest(request);
    const ipLimit = checkRateLimit(`holiday-guest-register:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
    if (!ipLimit.ok) {
      return jsonErr(
        "RATE_LIMIT",
        `Muitas tentativas. Aguarde ${ipLimit.retryAfterSec} segundos.`,
        429,
      );
    }

    const parsed = guestHolidayEventRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    if (isTurnstileConfigured()) {
      const captcha = await verifyTurnstileToken({
        token: parsed.data.captchaToken,
        ip,
      });
      if (!captcha.ok) {
        return jsonErr("CAPTCHA_FAILED", captcha.message, 400);
      }
    }

    const result = await registerGuestForHolidayEvent({
      holidayId,
      occurrenceDate: parsed.data.occurrenceDate,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      cpf: parsed.data.cpf,
    });

    if (!result.ok) {
      return jsonErr("VALIDATION_ERROR", result.message, 400);
    }

    return jsonOk(
      {
        registrationId: result.registration.id,
        alreadyRegistered: result.alreadyRegistered,
        message: result.alreadyRegistered
          ? "Você já estava inscrito neste evento."
          : "Inscrição realizada com sucesso!",
      },
      { status: result.alreadyRegistered ? 200 : 201 },
    );
  } catch (error) {
    console.error("[public/holiday-events/register]", error);
    return jsonErr("SERVER_ERROR", "Não foi possível concluir a inscrição agora.", 500);
  }
}
