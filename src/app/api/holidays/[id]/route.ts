import { prisma } from "@/lib/prisma";
import { requireRole, requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  normalizeHolidayTimeHm,
  updateHolidaySchema,
  validateHolidayEventTimesPair,
} from "@/lib/validators/holidays";
import { createAuditLog } from "@/lib/audit";
import { recalculateAllClassGroupSessionsAfterHolidayChange } from "@/lib/class-sessions-holiday-resync";
import { SENTINEL_YEAR_RECURRING } from "@/lib/schedule";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);
  const { id } = await context.params;

  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) return jsonErr("NOT_FOUND", "Feriado não encontrado.", 404);

  return jsonOk({ holiday });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffWrite();
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateHolidaySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Feriado não encontrado.", 404);

  const recurring = parsed.data.recurring ?? existing.recurring;
  let dateValue: Date | undefined;
  if (parsed.data.date) {
    const parsedDate = new Date(parsed.data.date + "T12:00:00.000Z");
    dateValue = recurring
      ? new Date(Date.UTC(SENTINEL_YEAR_RECURRING, parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
      : parsedDate;
  }

  const mergedStart =
    parsed.data.eventStartTime !== undefined
      ? parsed.data.eventStartTime?.trim() || null
      : existing.eventStartTime;
  const mergedEnd =
    parsed.data.eventEndTime !== undefined ? parsed.data.eventEndTime?.trim() || null : existing.eventEndTime;

  const pairErr = validateHolidayEventTimesPair(mergedStart, mergedEnd);
  if (pairErr) {
    return jsonErr("VALIDATION_ERROR", pairErr, 400);
  }

  const isEvent = !!(mergedStart && mergedEnd);
  const eventStartTime = isEvent ? normalizeHolidayTimeHm(mergedStart!) : null;
  const eventEndTime = isEvent ? normalizeHolidayTimeHm(mergedEnd!) : null;

  const effectiveDate = dateValue ?? existing.date;
  const duplicate = await prisma.holiday.findFirst({
    where: {
      date: effectiveDate,
      recurring,
      eventStartTime,
      eventEndTime,
      id: { not: id },
    },
    select: { id: true },
  });
  if (duplicate) {
    return jsonErr(
      "DUPLICATE_DATE",
      isEvent
        ? "Já existe um evento com esta data e horário."
        : recurring
          ? "Já existe um feriado recorrente para este dia e mês."
          : "Já existe um feriado para esta data.",
      409
    );
  }

  const updated = await prisma.holiday.update({
    where: { id },
    data: {
      ...(dateValue !== undefined && { date: dateValue }),
      ...(parsed.data.recurring !== undefined && { recurring: parsed.data.recurring }),
      name: parsed.data.name !== undefined ? (parsed.data.name || null) : undefined,
      isActive: parsed.data.isActive ?? undefined,
      ...(parsed.data.eventStartTime !== undefined || parsed.data.eventEndTime !== undefined
        ? { eventStartTime, eventEndTime }
        : {}),
    },
  });

  await createAuditLog({
    entityType: "Holiday",
    entityId: id,
    action: "UPDATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  const scheduleRecalculation = await recalculateAllClassGroupSessionsAfterHolidayChange();

  return jsonOk({ holiday: updated, scheduleRecalculation });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffWrite();
  const { id } = await context.params;

  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Feriado não encontrado.", 404);

  await prisma.holiday.delete({ where: { id } });

  await createAuditLog({
    entityType: "Holiday",
    entityId: id,
    action: "DELETE",
    diff: { before: existing },
    performedByUserId: user.id,
  });

  const scheduleRecalculation = await recalculateAllClassGroupSessionsAfterHolidayChange();

  return jsonOk({ deleted: true, scheduleRecalculation });
}
