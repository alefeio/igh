import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { signPasswordRecoveryStepToken } from "@/lib/password-recovery-token";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { normalizeCpfDigits, normalizePersonName } from "@/lib/student-identity-match";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 12;

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Etapa 1 (responsável): CPF do responsável + nome completo do aluno (menores / sem CPF do aluno no login).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const guardianRaw = typeof body?.guardianCpf === "string" ? body.guardianCpf : "";
  const studentNameRaw = typeof body?.studentName === "string" ? body.studentName : "";
  const digits = normalizeCpfDigits(guardianRaw);
  const nameNorm = normalizePersonName(studentNameRaw);

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

  if (!digits || nameNorm.length < 3) {
    const stepToken = await signPasswordRecoveryStepToken({ v: 0, uid: "", sid: "" });
    return jsonOk({ stepToken });
  }

  const gLimit = checkRateLimit(`rec:guard:${digits}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!gLimit.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMIT",
          message: `Muitas tentativas. Aguarde ${gLimit.retryAfterSec} segundos.`,
        },
      },
      { status: 429 }
    );
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; userId: string; name: string }>>`
    SELECT s.id, s."userId", s.name
    FROM "Student" s
    WHERE s."deletedAt" IS NULL
      AND s."userId" IS NOT NULL
      AND length(regexp_replace(COALESCE(s."guardianCpf", ''), '[^0-9]', '', 'g')) >= 1
      AND regexp_replace(COALESCE(s."guardianCpf", ''), '[^0-9]', '', 'g') = ${digits}
  `;

  const matches = rows.filter((r) => normalizePersonName(r.name) === nameNorm);

  let stepPayload: { v: 0 | 1; uid: string; sid: string } = { v: 0, uid: "", sid: "" };
  if (matches.length === 1 && matches[0].userId) {
    stepPayload = { v: 1, uid: matches[0].userId, sid: matches[0].id };
  }

  const stepToken = await signPasswordRecoveryStepToken(stepPayload);
  return jsonOk({ stepToken });
}
