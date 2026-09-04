import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

/**
 * Lista pré-inscrições do próximo ciclo (formulário público /pre-inscricao).
 */
export async function GET() {
  await requireRole(["ADMIN", "MASTER", "SITE_ADMIN"]);

  const items = await prisma.nextCycleInterest.findMany({
    orderBy: { createdAt: "desc" },
  });

  const allCourseIds = [...new Set(items.flatMap((i) => i.courseIds))];
  const courses =
    allCourseIds.length === 0
      ? []
      : await prisma.course.findMany({
          where: { id: { in: allCourseIds } },
          select: { id: true, name: true },
        });
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return jsonOk({
    items: items.map((item) => {
      const courseNames = item.courseIds
        .map((id) => courseNameById.get(id) ?? `Curso removido (${id.slice(0, 8)})`)
        .filter(Boolean);
      if (item.customCourseName?.trim()) {
        courseNames.push(`Outro: ${item.customCourseName.trim()}`);
      }
      return {
        id: item.id,
        name: item.name,
        phone: item.phone,
        email: item.email,
        courseIds: item.courseIds,
        courseNames,
        customCourseName: item.customCourseName,
        source: item.source,
        createdAt: item.createdAt.toISOString(),
      };
    }),
  });
}
