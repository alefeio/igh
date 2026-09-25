import { boardApiErrorResponse } from "@/lib/board-activities-http";
import { assembleAgendaSessions, buildClassSessionAgendaWhere, resolveBoardPeriod } from "@/lib/board-activities";
import { requireBoardAccess, resolvePilotUnitOrThrow } from "@/lib/board-activities-server";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";

/** Agenda dos professores — somente leitura a partir de ClassSession. */
export async function GET(request: Request) {
  try {
    await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const url = new URL(request.url);
    const period = resolveBoardPeriod({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    if (!period.ok) return jsonErr("VALIDATION_ERROR", period.message, 400);

    const teacherQ = url.searchParams.get("teacher")?.trim().toLowerCase() ?? "";

    const sessions = await prisma.classSession.findMany({
      where: buildClassSessionAgendaWhere(period.range),
      select: {
        id: true,
        sessionDate: true,
        startTime: true,
        endTime: true,
        status: true,
        classGroup: {
          select: {
            id: true,
            status: true,
            location: true,
            isExternal: true,
            course: { select: { name: true } },
            poloLocation: {
              select: { name: true, polo: { select: { name: true } } },
            },
            teacher: {
              select: {
                id: true,
                name: true,
              },
            },
            classGroupTeachers: {
              select: {
                teacher: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }, { id: "asc" }],
    });

    const mapped = assembleAgendaSessions(sessions);
    const filtered = teacherQ
      ? mapped.filter((s) => s.teachers.some((t) => t.name.toLowerCase().includes(teacherQ)))
      : mapped;

    return jsonOk({
      unit: { id: unit.id, name: unit.name },
      period: { from: period.range.from, to: period.range.to },
      sessions: filtered,
    });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
