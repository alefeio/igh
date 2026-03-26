import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";
import { loadExperienceFeedbackTurmaByUserIds } from "@/lib/platform-experience-turma";
import { buildPlatformExperiencePdf } from "@/lib/platform-experience-pdf";

const MAX_ROWS = 10000;

function fmtInt(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return n;
}

const emptySummary = {
  totalCount: 0,
  avgPlatform: null as number | null,
  minPlatform: null as number | null,
  maxPlatform: null as number | null,
  avgLessons: null as number | null,
  minLessons: null as number | null,
  maxLessons: null as number | null,
  avgTeacher: null as number | null,
  minTeacher: null as number | null,
  maxTeacher: null as number | null,
};

export async function GET() {
  const sessionUser = await requireRole(["TEACHER"]);

  const teacher = await prisma.teacher.findFirst({
    where: { userId: sessionUser.id, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    const pdfBytes = await buildPlatformExperiencePdf(
      "Avaliacoes de experiencia (minhas turmas)",
      emptySummary,
      [],
    );
    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="avaliacoes-experiencia-vazio.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      classGroup: { teacherId: teacher.id },
      student: { userId: { not: null }, deletedAt: null },
    },
    select: { student: { select: { userId: true } } },
  });

  const studentUserIds = [
    ...new Set(
      enrollments
        .map((e) => e.student.userId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  if (studentUserIds.length === 0) {
    const pdfBytes = await buildPlatformExperiencePdf(
      "Avaliacoes de experiencia (minhas turmas)",
      emptySummary,
      [],
    );
    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="avaliacoes-experiencia-vazio.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const where = { userId: { in: studentUserIds } };

  const [agg, rows] = await Promise.all([
    prisma.platformExperienceFeedback.aggregate({
      where,
      _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _min: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _max: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _count: { id: true },
    }),
    prisma.platformExperienceFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const turmaByUser = await loadExperienceFeedbackTurmaByUserIds(rows.map((r) => r.userId));

  const summary = {
    totalCount: agg._count.id,
    avgPlatform: formatExperienceAvg(agg._avg.ratingPlatform),
    minPlatform: fmtInt(agg._min.ratingPlatform),
    maxPlatform: fmtInt(agg._max.ratingPlatform),
    avgLessons: formatExperienceAvg(agg._avg.ratingLessons),
    minLessons: fmtInt(agg._min.ratingLessons),
    maxLessons: fmtInt(agg._max.ratingLessons),
    avgTeacher: formatExperienceAvg(agg._avg.ratingTeacher),
    minTeacher: fmtInt(agg._min.ratingTeacher),
    maxTeacher: fmtInt(agg._max.ratingTeacher),
  };

  const pdfRows = rows.map((r) => {
    const ctx = turmaByUser.get(r.userId) ?? {
      turmaLabel: "—",
      teacherNames: [] as string[],
    };
    const ct = r.commentTeacher?.trim();
    const teacherNamesLine =
      Boolean(ct) && ctx.teacherNames.length > 0 ? ctx.teacherNames.join(", ") : null;
    return {
      dateLabel: new Date(r.createdAt).toLocaleString("pt-BR"),
      userName: r.user.name,
      turmaLabel: ctx.turmaLabel,
      plat: r.ratingPlatform,
      aulas: r.ratingLessons,
      prof: r.ratingTeacher,
      commentPlatform: r.commentPlatform ?? "",
      commentLessons: r.commentLessons ?? "",
      teacherNamesLine,
      commentTeacher: ct ?? "",
      referral: r.referral ?? "",
    };
  });

  const pdfBytes = await buildPlatformExperiencePdf(
    "Avaliacoes de experiencia (minhas turmas)",
    summary,
    pdfRows,
  );
  const filename = `avaliacoes-minhas-turmas-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
