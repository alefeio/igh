import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";
import { loadExperienceFeedbackTurmaByUserIds } from "@/lib/platform-experience-turma";

export async function GET() {
  const sessionUser = await requireRole(["TEACHER"]);

  const teacher = await prisma.teacher.findFirst({
    where: { userId: sessionUser.id, deletedAt: null },
    select: { id: true },
  });

  const emptySummary = {
    totalCount: 0,
    avgPlatform: null as number | null,
    avgLessons: null as number | null,
    avgTeacher: null as number | null,
    minPlatform: null as number | null,
    maxPlatform: null as number | null,
    minLessons: null as number | null,
    maxLessons: null as number | null,
    minTeacher: null as number | null,
    maxTeacher: null as number | null,
  };

  if (!teacher) {
    return jsonOk({ summary: emptySummary, items: [] });
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
    return jsonOk({ summary: emptySummary, items: [] });
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
      take: 500,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const turmaByUser = await loadExperienceFeedbackTurmaByUserIds(
    rows.map((r) => r.userId),
  );

  return jsonOk({
    summary: {
      totalCount: agg._count.id,
      avgPlatform: formatExperienceAvg(agg._avg.ratingPlatform),
      avgLessons: formatExperienceAvg(agg._avg.ratingLessons),
      avgTeacher: formatExperienceAvg(agg._avg.ratingTeacher),
      minPlatform: agg._min.ratingPlatform,
      maxPlatform: agg._max.ratingPlatform,
      minLessons: agg._min.ratingLessons,
      maxLessons: agg._max.ratingLessons,
      minTeacher: agg._min.ratingTeacher,
      maxTeacher: agg._max.ratingTeacher,
    },
    items: rows.map((r) => {
      const ctx = turmaByUser.get(r.userId) ?? {
        turmaLabel: "—",
        teacherNames: [] as string[],
      };
      return {
        id: r.id,
        userId: r.userId,
        userName: r.user.name,
        userEmail: r.user.email,
        turmaLabel: ctx.turmaLabel,
        teacherNames: ctx.teacherNames,
        ratingPlatform: r.ratingPlatform,
        ratingLessons: r.ratingLessons,
        ratingTeacher: r.ratingTeacher,
        commentPlatform: r.commentPlatform,
        commentLessons: r.commentLessons,
        commentTeacher: r.commentTeacher,
        referral: r.referral,
        createdAt: r.createdAt.toISOString(),
      };
    }),
  });
}
