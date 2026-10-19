import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireStaffRead } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { listTeacherClassEvaluations } from "@/lib/teacher-class-evaluation-query";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaffRead();
    const items = await listTeacherClassEvaluations();
    return jsonOk({ items });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar as avaliações.", 500);
  }
}
