import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { applyClassGroupAutomaticStatusUpdatesCached } from "@/lib/class-group-auto-status";
import { publicInscrevaClassGroupWhere } from "@/lib/public-enrollment-availability";

/** Lista turmas para pré-matrícula (público, sem auth). Apenas PLANEJADA com vagas (matrículas ACTIVE menores que capacity). Query: courseId (uuid) para filtrar por curso. */

export async function GET(request: Request) {
  try {
    await applyClassGroupAutomaticStatusUpdatesCached();
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId")?.trim() || null;

    const classGroups = await prisma.classGroup.findMany({
      where: {
        ...publicInscrevaClassGroupWhere(),
        ...(courseId && { courseId }),
      },
      orderBy: [{ startDate: "asc" }, { course: { name: "asc" } }, { startTime: "asc" }],
      select: {
        id: true,
        capacity: true,
        startDate: true,
        endDate: true,
        daysOfWeek: true,
        startTime: true,
        endTime: true,
        location: true,
        status: true,
        course: { select: { id: true, name: true, description: true } },
        poloLocation: {
          select: { id: true, name: true, polo: { select: { id: true, name: true } } },
        },
        enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    });

    const withVagas = classGroups.filter((cg) => cg.enrollments.length < cg.capacity);

    return jsonOk({
      classGroups: withVagas.map((cg) => ({
        id: cg.id,
        courseId: cg.course.id,
        courseName: cg.course.name,
        courseDescription: cg.course.description,
        startDate: cg.startDate,
        endDate: cg.endDate,
        daysOfWeek: cg.daysOfWeek,
        startTime: cg.startTime,
        endTime: cg.endTime,
        location: cg.location,
        unit: cg.poloLocation
          ? {
              id: cg.poloLocation.id,
              name: cg.poloLocation.name,
              poloId: cg.poloLocation.polo.id,
              poloName: cg.poloLocation.polo.name,
            }
          : null,
        capacity: cg.capacity,
        seatsLeft: cg.capacity - cg.enrollments.length,
        status: cg.status,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar turmas.";
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}
