import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRead } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";
import { loadExperienceFeedbackTurmaByUserIds } from "@/lib/platform-experience-turma";
import {
  listAdminPlatformExperienceFeedback,
  loadAdminFilterOptions,
  parseAdminPlatformFeedbackQuery,
} from "@/lib/platform-experience-admin-query";

function fmtInt(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return n;
}

export async function GET(request: NextRequest) {
  const user = await requireStaffRead();

  const q = parseAdminPlatformFeedbackQuery(request.nextUrl.searchParams);
  const { rows, where } = await listAdminPlatformExperienceFeedback(q);

  const [agg, filterOptions] = await Promise.all([
    prisma.platformExperienceFeedback.aggregate({
      where,
      _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _min: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _max: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _count: { id: true },
    }),
    loadAdminFilterOptions(),
  ]);

  const turmaByUser = await loadExperienceFeedbackTurmaByUserIds(
    rows.map((r) => r.userId),
  );

  return jsonOk({
    canDeleteEvaluations: user.role === "MASTER",
    filterOptions,
    summary: {
      totalCount: agg._count.id,
      avgPlatform: formatExperienceAvg(agg._avg.ratingPlatform),
      avgLessons: formatExperienceAvg(agg._avg.ratingLessons),
      avgTeacher: formatExperienceAvg(agg._avg.ratingTeacher),
      minPlatform: fmtInt(agg._min.ratingPlatform),
      maxPlatform: fmtInt(agg._max.ratingPlatform),
      minLessons: fmtInt(agg._min.ratingLessons),
      maxLessons: fmtInt(agg._max.ratingLessons),
      minTeacher: fmtInt(agg._min.ratingTeacher),
      maxTeacher: fmtInt(agg._max.ratingTeacher),
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
