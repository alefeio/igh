import { getSessionUserFromCookie } from "@/lib/auth";
import { isHoneypotFilled, clientIpFromRequest } from "@/lib/bot-protection";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { serviceAttendanceSchema } from "@/lib/validators/service-attendance";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 10;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (isHoneypotFilled(body as Record<string, unknown> | null)) {
    return jsonOk({ message: "Avaliação registrada. Obrigado." }, { status: 201 });
  }

  const ip = clientIpFromRequest(request);
  const ipLimit = checkRateLimit(`service-attendance:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
  if (!ipLimit.ok) {
    return jsonErr("RATE_LIMIT", `Muitas avaliações. Aguarde ${ipLimit.retryAfterSec} segundos.`, 429);
  }

  const parsed = serviceAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const session = await getSessionUserFromCookie();
  const data = parsed.data;

  await prisma.serviceAttendanceRating.create({
    data: {
      score: data.score,
      channel: data.channel,
      comment: data.comment,
      name: data.name,
      email: data.email?.toLowerCase() ?? null,
      phone: data.phone,
      userId: session?.id ?? null,
    },
  });

  return jsonOk({ message: "Avaliação registrada. Obrigado." }, { status: 201 });
}
