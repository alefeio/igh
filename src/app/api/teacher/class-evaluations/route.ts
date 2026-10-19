import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { listTeacherClassEvaluations } from "@/lib/teacher-class-evaluation-query";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["TEACHER"]);
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return jsonOk({ items: [] });
    const items = await listTeacherClassEvaluations(teacher.id);
    return jsonOk({
      items: items.map((item) => ({ ...item, teacherName: "" })),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    return jsonErr("INTERNAL", "Não foi possível carregar as avaliações.", 500);
  }
}
