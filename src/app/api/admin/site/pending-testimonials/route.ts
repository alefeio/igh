import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

  const items = await prisma.pendingTestimonial.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ items });
}
