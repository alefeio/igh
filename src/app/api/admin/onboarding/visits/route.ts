import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
/** Quem acessou a página de onboarding (Master/Admin). */
export async function GET() {
  await requireRole(["MASTER", "ADMIN"]);

  const visits = await prisma.onboardingUserVisit.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 500,
    select: {
      id: true,
      role: true,
      firstSeenAt: true,
      lastSeenAt: true,
      viewCount: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const totalUsers = await prisma.onboardingUserVisit.count();
  const totalViews = await prisma.onboardingUserVisit.aggregate({ _sum: { viewCount: true } });

  return jsonOk({
    visits,
    summary: {
      distinctUsers: totalUsers,
      totalViews: totalViews._sum.viewCount ?? 0,
    },
  });
}
