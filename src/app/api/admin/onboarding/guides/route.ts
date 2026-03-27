import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Lista guias de onboarding (Master/Admin). */
export async function GET() {
  await requireRole(["MASTER", "ADMIN"]);

  const guides = await prisma.onboardingGuide.findMany({
    orderBy: { role: "asc" },
    select: {
      role: true,
      title: true,
      contentRich: true,
      updatedAt: true,
      updatedBy: { select: { name: true, email: true } },
    },
  });

  return jsonOk({ guides });
}
