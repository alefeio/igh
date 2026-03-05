import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getPendingSiteChange, rejectPendingSiteChange } from "@/lib/pending-site-change";

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
  await rejectPendingSiteChange(id, user.id);
  return jsonOk({ rejected: true });
}
