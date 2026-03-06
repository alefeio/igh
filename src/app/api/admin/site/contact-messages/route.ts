import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

  await prisma.contactMessage.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });

  const items = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({
    items: items.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      message: m.message,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
      repliedAt: m.repliedAt?.toISOString() ?? null,
    })),
  });
}
