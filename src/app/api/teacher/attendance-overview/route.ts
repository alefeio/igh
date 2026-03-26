import { prisma } from "@/lib/prisma";
import { getAttendanceOverview } from "@/lib/attendance-session-summary";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/**
 * Resumo por sessão apenas das turmas do professor.
 */
export async function GET(request: Request) {
  const user = await requireRole(["TEACHER"]);

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    return jsonOk({
      groups: [],
      totals: {
        presentSum: 0,
        absentSum: 0,
        justifiedAbsentSum: 0,
        sessionCount: 0,
        classGroupCount: 0,
      },
    });
  }

  const { searchParams } = new URL(request.url);
  const classGroupIdParam = searchParams.get("classGroupId")?.trim() || undefined;

  if (classGroupIdParam) {
    const owns = await prisma.classGroup.findFirst({
      where: { id: classGroupIdParam, teacherId: teacher.id },
      select: { id: true },
    });
    if (!owns) {
      return jsonErr("FORBIDDEN", "Turma não encontrada ou você não é o professor desta turma.", 403);
    }
  }

  const { groups, totals } = await getAttendanceOverview({
    classGroupId: classGroupIdParam,
    teacherId: teacher.id,
  });

  return jsonOk({ groups, totals });
}
