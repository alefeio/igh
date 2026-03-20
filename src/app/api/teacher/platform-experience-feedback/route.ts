import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";

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
      _count: { id: true },
    }),
    prisma.platformExperienceFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return jsonOk({
    summary: {
      totalCount: agg._count.id,
      avgPlatform: formatExperienceAvg(agg._avg.ratingPlatform),
      avgLessons: formatExperienceAvg(agg._avg.ratingLessons),
      avgTeacher: formatExperienceAvg(agg._avg.ratingTeacher),
    },
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userEmail: r.user.email,
      ratingPlatform: r.ratingPlatform,
      ratingLessons: r.ratingLessons,
      ratingTeacher: r.ratingTeacher,
      comment: r.comment,
      referral: r.referral,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
