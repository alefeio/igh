import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification-token";
import { jsonErr, jsonOk } from "@/lib/http";
import { verifyPasswordRecoveryStepToken } from "@/lib/password-recovery-token";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { birthDateMatchesDatabase } from "@/lib/student-identity-match";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_VERIFY_PER_WINDOW = 24;

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function recoveryFailDelay() {
  await new Promise((r) => setTimeout(r, 350 + Math.floor(Math.random() * 250)));
}

const GENERIC_FAIL = "Não foi possível validar os dados. Confira a data de nascimento cadastrada ou procure a secretaria.";

/**
 * Etapa 2: confirma data de nascimento do aluno e emite token de redefinição (mesmo fluxo do e-mail).
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const vLimit = checkRateLimit(`rec:verify:${ip}`, MAX_VERIFY_PER_WINDOW, WINDOW_MS);
  if (!vLimit.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMIT",
          message: `Muitas tentativas. Aguarde ${vLimit.retryAfterSec} segundos.`,
        },
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const stepToken = typeof body?.stepToken === "string" ? body.stepToken.trim() : "";
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate.trim() : "";

  if (!stepToken || !birthDate) {
    await recoveryFailDelay();
    return jsonErr("VALIDATION_ERROR", GENERIC_FAIL, 400);
  }

  const payload = await verifyPasswordRecoveryStepToken(stepToken);
  if (!payload || payload.v !== 1 || !payload.uid || !payload.sid) {
    await recoveryFailDelay();
    return jsonErr("VERIFY_FAILED", GENERIC_FAIL, 400);
  }

  const student = await prisma.student.findFirst({
    where: { id: payload.sid, userId: payload.uid, deletedAt: null },
    select: {
      birthDate: true,
      user: { select: { isActive: true } },
    },
  });

  if (!student?.user?.isActive || !birthDateMatchesDatabase(student.birthDate, birthDate)) {
    await recoveryFailDelay();
    return jsonErr("VERIFY_FAILED", GENERIC_FAIL, 400);
  }

  const { token } = await createVerificationToken({
    userId: payload.uid,
    type: "PASSWORD_RESET",
    studentId: payload.sid,
    expiresInDays: 1,
  });

  return jsonOk({ resetToken: token });
}
