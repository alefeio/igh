import {
  clientIpFromRequest,
  isHoneypotFilled,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "@/lib/bot-protection";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateNextCycleInterestConfirmation } from "@/lib/email/templates";
import { jsonErr, jsonOk } from "@/lib/http";
import { findEligibleCoursesForInterest } from "@/lib/next-cycle-interest";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { nextCycleInterestSchema } from "@/lib/validators/next-cycle-interest";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 15;

/**
 * Registra interesse / pré-inscrição no próximo ciclo (sem conta obrigatória)
 * e envia e-mail de confirmação.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (isHoneypotFilled(body as Record<string, unknown> | null)) {
      return jsonOk({ id: "ok", message: "Pré-inscrição registrada." }, { status: 201 });
    }

    const ip = clientIpFromRequest(request);
    const ipLimit = checkRateLimit(`next-cycle-interest:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
    if (!ipLimit.ok) {
      return jsonErr(
        "RATE_LIMIT",
        `Muitas tentativas. Aguarde ${ipLimit.retryAfterSec} segundos.`,
        429,
      );
    }

    const parsed = nextCycleInterestSchema.safeParse(body);
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

    const requestedIds = [...new Set(parsed.data.courseIds)];
    const customCourseName = parsed.data.customCourseName;
    const eligible = await findEligibleCoursesForInterest(requestedIds);

    if (requestedIds.length > 0 && eligible.length !== requestedIds.length) {
      return jsonErr("VALIDATION_ERROR", "Um ou mais cursos selecionados são inválidos.", 400);
    }

    const courseLabels = [
      ...eligible.map((c) => c.name),
      ...(customCourseName ? [customCourseName] : []),
    ];
    const courseLabel =
      courseLabels.length > 0 ? courseLabels.join(", ") : "Curso informado";

    const created = await prisma.nextCycleInterest.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        courseIds: eligible.map((c) => c.id),
        customCourseName,
        source: "site",
      },
      select: { id: true },
    });

    const { subject, html } = templateNextCycleInterestConfirmation({
      name: parsed.data.name,
      courseLabel,
    });
    try {
      await sendEmailAndRecord({
        to: parsed.data.email,
        subject,
        html,
        emailType: "next_cycle_interest_confirmation",
        entityType: "NextCycleInterest",
        entityId: created.id,
        performedByUserId: null,
      });
    } catch (emailError) {
      console.error("[public/next-cycle-interest] email", emailError);
    }

    return jsonOk(
      {
        id: created.id,
        message:
          "Pré-inscrição registrada! Enviamos um e-mail de confirmação. Entraremos em contato quando o próximo ciclo abrir.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[public/next-cycle-interest POST]", error);
    return jsonErr("SERVER_ERROR", "Não foi possível registrar a pré-inscrição agora.", 500);
  }
}
