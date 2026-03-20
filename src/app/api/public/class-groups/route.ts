import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";

/** Lista turmas abertas para pré-matrícula (público, sem auth). Apenas status ABERTA — não inclui EM_ANDAMENTO, INTERNO, etc. Só retorna turmas com vagas (enrollments ACTIVE < capacity). Query: courseId (uuid) para filtrar por curso. */
const PUBLIC_INSCREVA_STATUS = "ABERTA" as const;

export async function GET(request: Request) {
  try {
    await applyClassGroupAutomaticStatusUpdates();
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId")?.trim() || null;

    const classGroups = await prisma.classGroup.findMany({
      where: {
        status: PUBLIC_INSCREVA_STATUS,
        ...(courseId && { courseId }),
        course: { status: "ACTIVE" },
      },
      orderBy: [{ startDate: "asc" }, { course: { name: "asc" } }, { startTime: "asc" }],
      select: {
        id: true,
        capacity: true,
        startDate: true,
        daysOfWeek: true,
        startTime: true,
        endTime: true,
        location: true,
        status: true,
        course: { select: { id: true, name: true } },
        enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    });

    const withVagas = classGroups.filter((cg) => cg.enrollments.length < cg.capacity);

    return jsonOk({
      classGroups: withVagas.map((cg) => ({
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
