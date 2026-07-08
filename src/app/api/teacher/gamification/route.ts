import { requireRole } from "@/lib/auth";
import { resolveGamificationCycleId } from "@/lib/gamification-cycle";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { computeTeacherGamification } from "@/lib/teacher-gamification";

/** Gamificação do professor logado. */
export async function GET(request: Request) {
  const user = await requireRole(["TEACHER"]);
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);
  }
  const { searchParams } = new URL(request.url);
  const cycleId = await resolveGamificationCycleId(searchParams.get("cycleId"));
  const data = await computeTeacherGamification(teacher.id, { cycleId });
  if (!data) return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);
  return jsonOk({ ...data, cycleId });
}
