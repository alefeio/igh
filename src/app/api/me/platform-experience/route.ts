import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { parseRating1to10 } from "@/lib/platform-experience-feedback";

const MAX_TOPIC_COMMENT = 4000;
const MAX_REFERRAL = 2000;

/** Indica se o aluno já enviou alguma avaliação (para texto do botão / UX) + professores em turmas em andamento. */
export async function GET() {
  const user = await requireRole("STUDENT");
  const [count, student] = await Promise.all([
    prisma.platformExperienceFeedback.count({
      where: { userId: user.id },
    }),
    prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    }),
  ]);

  let ongoingTeachers: { id: string; name: string }[] = [];
  if (student) {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        status: "ACTIVE",
        classGroup: { status: "EM_ANDAMENTO" },
      },
      select: {
        classGroup: {
          select: {
            teacher: { select: { id: true, name: true } },
          },
        },
      },
    });
    const byId = new Map<string, string>();
    for (const e of enrollments) {
      const t = e.classGroup.teacher;
      byId.set(t.id, t.name);
    }
    ongoingTeachers = [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  return jsonOk({
    hasSubmitted: count > 0,
    submissionCount: count,
    ongoingTeachers,
  });
}

/**
 * Registra avaliação (sempre cria um novo registro).
 * Body: { ratingPlatform, ratingLessons, ratingTeacher (1–10 cada),
 *   commentPlatform?, commentLessons?, commentTeacher?, referral? }
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

  const slice = (v: unknown) =>
    typeof v === "string" ? v.trim().slice(0, MAX_TOPIC_COMMENT) : "";
  const commentPlatform = slice(body?.commentPlatform);
  const commentLessons = slice(body?.commentLessons);
  const commentTeacher = slice(body?.commentTeacher);
  const referral =
    typeof body?.referral === "string" ? body.referral.trim().slice(0, MAX_REFERRAL) : "";

  const row = await prisma.platformExperienceFeedback.create({
    data: {
      userId: user.id,
      ratingPlatform,
      ratingLessons,
      ratingTeacher,
      commentPlatform: commentPlatform.length > 0 ? commentPlatform : null,
      commentLessons: commentLessons.length > 0 ? commentLessons : null,
      commentTeacher: commentTeacher.length > 0 ? commentTeacher : null,
      referral: referral.length > 0 ? referral : null,
    },
    select: { id: true, createdAt: true },
  });

  return jsonOk({ id: row.id, createdAt: row.createdAt.toISOString() });
}
