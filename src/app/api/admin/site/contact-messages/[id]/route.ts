import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const body = await _request.json().catch(() => null);
  const replied = body && typeof body.replied === "boolean" ? body.replied : null;
  if (replied === null) {
    return jsonErr("VALIDATION_ERROR", "Envie { \"replied\": true } ou { \"replied\": false }.", 400);
  }

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { repliedAt: replied ? new Date() : null },
  });

  return jsonOk({
    id: updated.id,
    repliedAt: updated.repliedAt?.toISOString() ?? null,
  });
}
