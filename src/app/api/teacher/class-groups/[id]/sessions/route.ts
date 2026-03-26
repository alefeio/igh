import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

function getTodayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Lista sessões da turma (para frequência: sessões com status LIBERADA). Apenas professor dono da turma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findUnique({
    where: { id: classGroupId, teacherId: teacher.id },
    select: { id: true },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  // Garante que sessões até hoje estejam liberadas para o professor também
  // (antes a liberação era atualizada no fluxo do aluno).
  const today = getTodayUtcDate();
  await prisma.classSession.updateMany({
    where: {
      classGroupId,
      status: "SCHEDULED",
      sessionDate: { lte: today },
    },
    data: { status: "LIBERADA" },
  });

  const [sessions, activeEnrollmentCount] = await Promise.all([
    prisma.classSession.findMany({
      where: { classGroupId },
      orderBy: { sessionDate: "asc" },
      select: {
        id: true,
        sessionDate: true,
        startTime: true,
        endTime: true,
        status: true,
        lessonId: true,
        lesson: { select: { id: true, title: true, order: true } },
      },
    }),
    prisma.enrollment.count({
      where: { classGroupId, status: "ACTIVE" },
    }),
  ]);

  const liberadaIds = sessions.filter((s) => s.status === "LIBERADA").map((s) => s.id);
  const attendanceRows =
    liberadaIds.length > 0
      ? await prisma.sessionAttendance.findMany({
          where: { classSessionId: { in: liberadaIds } },
          select: { classSessionId: true, present: true },
        })
      : [];

  const summaryBySession = new Map<string, { recorded: number; present: number }>();
  for (const row of attendanceRows) {
    const cur = summaryBySession.get(row.classSessionId) ?? { recorded: 0, present: 0 };
    cur.recorded += 1;
    if (row.present) cur.present += 1;
    summaryBySession.set(row.classSessionId, cur);
  }

  return jsonOk({
    sessions: sessions.map((s) => {
      const canTake = s.status === "LIBERADA";
      const sum = canTake ? summaryBySession.get(s.id) : undefined;
      const recordedCount = sum?.recorded ?? 0;
      const presentCount = sum?.present ?? 0;
      const absentCount = recordedCount - presentCount;
      return {
        id: s.id,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        lessonId: s.lessonId,
        lessonTitle: s.lesson?.title ?? null,
        lessonOrder: s.lesson?.order ?? null,
        /** Sessão com aula liberada (pode fazer frequência). */
        canTakeAttendance: canTake,
        /** Resumo de frequência já lançada (só faz sentido com aula liberada). */
        attendanceSummary: canTake
          ? {
              enrollmentTotal: activeEnrollmentCount,
              recordedCount,
              presentCount,
              absentCount,
              /** Pelo menos um registro em SessionAttendance = frequência já iniciada/salva. */
              hasAttendanceSaved: recordedCount > 0,
              /** Todos os alunos ativos têm registro (frequência completa para a turma). */
              isAttendanceComplete:
                activeEnrollmentCount > 0 && recordedCount >= activeEnrollmentCount,
            }
          : null,
      };
    }),
  });
}
