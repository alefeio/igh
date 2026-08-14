import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { applyClassGroupAutomaticStatusUpdatesCached } from "@/lib/class-group-auto-status";
import { publicInscrevaClassGroupWhere } from "@/lib/public-enrollment-availability";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";

/** Lista turmas para pré-matrícula e lista de espera (público). Inclui lotadas (waitlistOnly). */

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
        cycleId: true,
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
        enrollments: { where: { status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } }, select: { id: true } },
      },
    });

    const withVagas = classGroups.map((cg) => ({
      id: cg.id,
      cycleId: cg.cycleId,
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
      seatsLeft: Math.max(0, cg.capacity - cg.enrollments.length),
      waitlistOnly: cg.enrollments.length >= cg.capacity,
      status: cg.status,
    }));

    return jsonOk({
      classGroups: withVagas,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar turmas.";
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}
