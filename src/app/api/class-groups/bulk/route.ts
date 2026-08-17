import { requireRole } from "@/lib/auth";
import { applyClassGroupUpdate } from "@/lib/class-group-update";
import { jsonErr, jsonOk } from "@/lib/http";
import { bulkUpdateClassGroupsSchema } from "@/lib/validators/class-groups";
import {
  poloCoordinatorOwnsClassGroup,
  poloCoordinatorOwnsPoloLocation,
} from "@/lib/polo-coordinator-scope";

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "POLO_COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = bulkUpdateClassGroupsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const ids = [...new Set(parsed.data.ids)];
  const patch = parsed.data.patch;

  if (user.role === "POLO_COORDINATOR") {
    for (const id of ids) {
      const owns = await poloCoordinatorOwnsClassGroup(user.id, id);
      if (!owns) {
        return jsonErr("FORBIDDEN", "Você só pode editar turmas dos polos que coordena.", 403);
      }
    }
    if (patch.poloLocationId) {
      const locOk = await poloCoordinatorOwnsPoloLocation(user.id, patch.poloLocationId);
      if (!locOk) {
        return jsonErr(
          "FORBIDDEN",
          "Você só pode vincular turmas a um local dos polos que coordena.",
          403,
        );
      }
    }
  }
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
