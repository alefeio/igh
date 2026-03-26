import { getAttendanceOverview } from "@/lib/attendance-session-summary";
import { requireStaffRead } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

/**
 * Resumo de frequência agregado por turma (sem listar cada aula).
 * Query opcional: classGroupId.
 */
export async function GET(request: Request) {
  await requireStaffRead();

  const { searchParams } = new URL(request.url);
  const classGroupId = searchParams.get("classGroupId")?.trim() || undefined;

  const { groups, totals } = await getAttendanceOverview({ classGroupId });

  return jsonOk({ groups, totals });
}
