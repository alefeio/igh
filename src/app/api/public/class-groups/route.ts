import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista turmas abertas para pré-matrícula (público, sem auth). */
export async function GET() {
  try {
    const classGroups = await prisma.classGroup.findMany({
      where: {
        status: { in: ["ABERTA", "EM_ANDAMENTO", "PLANEJADA"] },
      },
      orderBy: [{ startDate: "asc" }, { course: { name: "asc" } }, { startTime: "asc" }],
      select: {
        id: true,
        startDate: true,
        daysOfWeek: true,
        startTime: true,
        endTime: true,
        location: true,
        status: true,
        course: { select: { id: true, name: true } },
      },
    });

    return jsonOk({
      classGroups: classGroups.map((cg) => ({
        id: cg.id,
        courseId: cg.course.id,
        courseName: cg.course.name,
        startDate: cg.startDate,
        daysOfWeek: cg.daysOfWeek,
        startTime: cg.startTime,
        endTime: cg.endTime,
        location: cg.location,
        status: cg.status,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar turmas.";
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}
