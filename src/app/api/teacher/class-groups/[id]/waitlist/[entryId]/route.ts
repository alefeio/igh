import { enrollStudentFromWaitlist } from "@/lib/enrollment-waitlist";
import { jsonErr, jsonOk } from "@/lib/http";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";

/** Inclui na turma o aluno escolhido na lista de espera, se houver vaga. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id: classGroupId, entryId } = await context.params;
  const access = await requireReadableClassGroup(classGroupId);
  if ("error" in access) return access.error;
  if (access.readOnly) {
    return jsonErr("FORBIDDEN", "Somente o professor da turma pode incluir alunos da lista de espera.", 403);
  }

  const result = await enrollStudentFromWaitlist({
    classGroupId,
    waitlistId: entryId,
    performedByUserId: access.user.id,
  });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 409;
    return jsonErr(result.code, result.message, status);
  }

  return jsonOk({ enrollmentId: result.enrollmentId });
}
