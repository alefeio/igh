import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createTimeSlotSchema } from "@/lib/validators/time-slots";
import { createAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  await requireRole("MASTER");

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly");
  const where = activeOnly === "true" ? { isActive: true } : {};

  const timeSlots = await prisma.timeSlot.findMany({
    where,
    orderBy: { startTime: "asc" },
  });

  return jsonOk({ timeSlots });
}

export async function POST(request: Request) {
  const user = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createTimeSlotSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const timeSlot = await prisma.timeSlot.create({
    data: {
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      name: parsed.data.name || null,
      isActive: parsed.data.isActive ?? true,
    },
  });

  await createAuditLog({
    entityType: "TimeSlot",
    entityId: timeSlot.id,
    action: "CREATE",
    diff: { after: timeSlot },
    performedByUserId: user.id,
  });

  return jsonOk({ timeSlot }, { status: 201 });
}
