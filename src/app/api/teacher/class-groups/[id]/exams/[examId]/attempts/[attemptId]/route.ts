import { jsonErr, jsonOk } from "@/lib/http";
import { buildAttemptReview } from "@/lib/class-group-exam-teacher-view";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ id: string; examId: string; attemptId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId, attemptId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const review = await buildAttemptReview(attemptId, classGroupId);
  if (!review) return jsonErr("NOT_FOUND", "Tentativa não encontrada.", 404);

  return jsonOk(review);
}
