import { requireRole } from "@/lib/auth";
import { resolveGamificationCycleId } from "@/lib/gamification-cycle";
import { jsonOk } from "@/lib/http";
import { computeAllTeachersGamification } from "@/lib/teacher-gamification";

/** Quadro comparativo: todos os professores. Admin e Master. */
export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { searchParams } = new URL(request.url);
  const cycleId = await resolveGamificationCycleId(searchParams.get("cycleId"));
  const ranking = await computeAllTeachersGamification({ cycleId });
  return jsonOk({ ranking, cycleId });
}
