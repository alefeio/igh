import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { approvePendingSiteChange, getPendingSiteChange } from "@/lib/pending-site-change";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;
  const pending = await getPendingSiteChange(id);
  if (!pending) {
    return jsonErr("NOT_FOUND", "Solicitação não encontrada ou já processada.", 404);
  }
  try {
    await approvePendingSiteChange(id, user.id);
    return jsonOk({ approved: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao aplicar alteração.";
    return jsonErr("APPLY_ERROR", message, 500);
  }
}
