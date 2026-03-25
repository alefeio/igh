import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { signPasswordRecoveryStepToken } from "@/lib/password-recovery-token";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { normalizeCpfDigits } from "@/lib/student-identity-match";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 12;

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Etapa 1 (CPF do aluno): sempre devolve stepToken; só após data de nascimento é emitido reset.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const raw = typeof body?.cpf === "string" ? body.cpf : "";
  const digits = normalizeCpfDigits(raw);

  const ip = clientIp(request);
  const ipLimit = checkRateLimit(`rec:ip:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!ipLimit.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMIT",
          message: `Muitas tentativas. Aguarde ${ipLimit.retryAfterSec} segundos.`,
        },
      },
      { status: 429 }
    );
  }

  if (!digits) {
    const stepToken = await signPasswordRecoveryStepToken({ v: 0, uid: "", sid: "" });
    return jsonOk({ stepToken });
  }

  const cpfLimit = checkRateLimit(`rec:cpf:${digits}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!cpfLimit.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMIT",
          message: `Muitas tentativas para este CPF. Aguarde ${cpfLimit.retryAfterSec} segundos.`,
        },
      },
      { status: 429 }
    );
  }

  const student = await prisma.student.findFirst({
    where: { cpf: digits, deletedAt: null, userId: { not: null } },
    select: {
      id: true,
      userId: true,
      user: { select: { isActive: true } },
    },
  });

  const ok =
    !!student?.userId && student.user?.isActive === true;

  const stepToken = await signPasswordRecoveryStepToken(
    ok ? { v: 1, uid: student!.userId!, sid: student!.id } : { v: 0, uid: "", sid: "" }
  );

  return jsonOk({ stepToken });
}
