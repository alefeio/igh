import { boardApiErrorResponse } from "@/lib/board-activities-http";
import { markTeacherScheduleConflicts, resolveBoardPeriod } from "@/lib/board-activities";
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
      where: {
        sessionDate: {
          gte: period.range.fromUtc,
          lt: period.range.toExclusiveUtc,
        },
        classGroup: {
          poloLocationId: unit.id,
        },
      },
      select: {
        id: true,
        sessionDate: true,
        startTime: true,
        endTime: true,
        status: true,
        classGroup: {
          select: {
            id: true,
            location: true,
            course: { select: { name: true } },
            teacher: {
              select: {
                id: true,
                name: true,
                userId: true,
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
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      take: 1000,
    });

    type Slot = {
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
      courseName: string;
      classGroupId: string;
      location: string | null;
      teachers: { id: string; name: string }[];
      conflict: boolean;
    };

    const slots: Slot[] = sessions.map((s) => {
      const titular = s.classGroup.teacher;
      const co = s.classGroup.classGroupTeachers.map((t) => t.teacher);
      const teachersMap = new Map<string, { id: string; name: string }>();
      teachersMap.set(titular.id, { id: titular.id, name: titular.name });
      for (const t of co) teachersMap.set(t.id, t);
      return {
        id: s.id,
        date: s.sessionDate.toISOString().slice(0, 10),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        courseName: s.classGroup.course.name,
        classGroupId: s.classGroup.id,
        location: s.classGroup.location,
        teachers: [...teachersMap.values()],
        conflict: false,
      };
    });

    const filtered = teacherQ
      ? slots.filter((s) => s.teachers.some((t) => t.name.toLowerCase().includes(teacherQ)))
      : slots;

    markTeacherScheduleConflicts(filtered);

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
