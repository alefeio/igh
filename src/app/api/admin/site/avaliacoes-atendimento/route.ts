import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { SERVICE_CHANNEL_LABEL, SERVICE_SCORE_FACES, formatBrazilPhoneMask } from "@/lib/service-attendance";

export async function GET() {
  try {
    await requireRole(["SITE_ADMIN", "MASTER"]);

    const [stats, items] = await Promise.all([
      prisma.serviceAttendanceRating.aggregate({
        _avg: { score: true },
        _count: { _all: true },
      }),
      prisma.serviceAttendanceRating.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    const count = stats._count._all;
    const average = stats._avg.score == null ? null : Math.round(stats._avg.score * 10) / 10;

    return jsonOk({
      summary: { count, average },
      items: items.map((item) => ({
        id: item.id,
        score: item.score,
        emoji: SERVICE_SCORE_FACES.find((face) => face.score === item.score)?.emoji ?? "",
        label: SERVICE_SCORE_FACES.find((face) => face.score === item.score)?.label ?? "",
        channel: item.channel,
        channelLabel: SERVICE_CHANNEL_LABEL[item.channel],
        comment: item.comment,
        name: item.name,
        email: item.email,
        phone: item.phone ? formatBrazilPhoneMask(item.phone) : null,
        userName: item.user?.name ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
