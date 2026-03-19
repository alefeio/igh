import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { computeAllTeachersGamification } from "@/lib/teacher-gamification";

/** Quadro comparativo: todos os professores. Admin e Master. */
export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const ranking = await computeAllTeachersGamification();
  return jsonOk({ ranking });
}
