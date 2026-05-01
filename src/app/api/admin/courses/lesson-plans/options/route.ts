import { prisma } from "@/lib/prisma";
import { requireStaffRead } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export async function GET() {
  await requireStaffRead();

  const courses = await prisma.course.findMany({
    where: { status: { not: "INACTIVE" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      workloadHours: true,
      modules: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              durationMinutes: true,
              summary: true,
              pdfUrl: true,
              attachmentUrls: true,
              attachmentNames: true,
            },
          },
        },
      },
    },
  });

  return jsonOk({ courses });
}

