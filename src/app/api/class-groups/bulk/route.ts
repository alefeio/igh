import { requireStaffWrite } from "@/lib/auth";
import { applyClassGroupUpdate } from "@/lib/class-group-update";
import { jsonErr, jsonOk } from "@/lib/http";
import { bulkUpdateClassGroupsSchema } from "@/lib/validators/class-groups";

export async function PATCH(request: Request) {
  const user = await requireStaffWrite();
  const body = await request.json().catch(() => null);
  const parsed = bulkUpdateClassGroupsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const ids = [...new Set(parsed.data.ids)];
  const patch = parsed.data.patch;
  const updated: string[] = [];
  const regenerated: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  // Sempre ignora as outras turmas do mesmo lote no check de duplicata.
  // Senão, ao mudar data/dias/horário, a 2ª turma via a 1ª (já atualizada) como conflito
  // e abortava — sem regenerar as aulas.
  for (const id of ids) {
    const result = await applyClassGroupUpdate({
      id,
      data: patch,
      performedByUserId: user.id,
      skipDuplicateIds: ids,
    });
    if (!result.ok) {
      errors.push({ id, message: result.message });
      continue;
    }
    updated.push(id);
    if (result.sessionsRegenerated) regenerated.push(id);
  }

  return jsonOk({
    updatedCount: updated.length,
    regeneratedCount: regenerated.length,
    errorCount: errors.length,
    updated,
    regenerated,
    errors,
  });
}
