import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

  const [agg, rows] = await Promise.all([
    prisma.platformExperienceFeedback.aggregate({
      _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _count: { id: true },
    }),
    prisma.platformExperienceFeedback.findMany({
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
