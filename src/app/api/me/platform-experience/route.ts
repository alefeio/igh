import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { parseRating1to10 } from "@/lib/platform-experience-feedback";

const MAX_COMMENT = 4000;
const MAX_REFERRAL = 2000;

/** Indica se o aluno já enviou alguma avaliação (para texto do botão / UX). */
export async function GET() {
  const user = await requireRole("STUDENT");
  const count = await prisma.platformExperienceFeedback.count({
    where: { userId: user.id },
  });

  return jsonOk({ hasSubmitted: count > 0, submissionCount: count });
}

/**
 * Registra avaliação (sempre cria um novo registro).
 * Body: { ratingPlatform, ratingLessons, ratingTeacher (1–10 cada), comment?, referral? }
 */
export async function POST(request: Request) {
  const user = await requireRole("STUDENT");

  const body = await request.json().catch(() => null);
  const ratingPlatform = parseRating1to10(body?.ratingPlatform);
  const ratingLessons = parseRating1to10(body?.ratingLessons);
  const ratingTeacher = parseRating1to10(body?.ratingTeacher);

  if (ratingPlatform == null || ratingLessons == null || ratingTeacher == null) {
    return jsonErr(
      "VALIDATION_ERROR",
      "Informe uma nota inteira de 1 a 10 para plataforma, aulas e professor.",
      400,
    );
  }

  const comment =
    typeof body?.comment === "string" ? body.comment.trim().slice(0, MAX_COMMENT) : "";
  const referral =
    typeof body?.referral === "string" ? body.referral.trim().slice(0, MAX_REFERRAL) : "";

  const row = await prisma.platformExperienceFeedback.create({
    data: {
      userId: user.id,
      ratingPlatform,
      ratingLessons,
      ratingTeacher,
      comment: comment.length > 0 ? comment : null,
      referral: referral.length > 0 ? referral : null,
    },
    select: { id: true, createdAt: true },
  });

  return jsonOk({ id: row.id, createdAt: row.createdAt.toISOString() });
}
