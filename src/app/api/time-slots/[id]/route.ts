import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateTimeSlotSchema } from "@/lib/validators/time-slots";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateTimeSlotSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.timeSlot.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Horário não encontrado.", 404);

  const updated = await prisma.timeSlot.update({
    where: { id },
    data: {
      startTime: parsed.data.startTime ?? undefined,
      endTime: parsed.data.endTime ?? undefined,
      name: parsed.data.name !== undefined ? (parsed.data.name || null) : undefined,
      isActive: parsed.data.isActive ?? undefined,
    },
  });

  await createAuditLog({
    entityType: "TimeSlot",
    entityId: id,
    action: "UPDATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ timeSlot: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const existing = await prisma.timeSlot.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Horário não encontrado.", 404);

  await prisma.timeSlot.delete({ where: { id } });

  await createAuditLog({
    entityType: "TimeSlot",
    entityId: id,
    action: "DELETE",
    diff: { before: existing },
    performedByUserId: user.id,
  });

  return jsonOk({ deleted: true });
}
