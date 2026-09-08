import { prisma } from "@/lib/prisma";
import { requireMaster, requireStaffRead } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  normalizeHolidayTimeHm,
  updateHolidaySchema,
  validateHolidayEventTimesPair,
} from "@/lib/validators/holidays";
import { createAuditLog } from "@/lib/audit";
import { recalculateAllClassGroupSessionsAfterHolidayChange } from "@/lib/class-sessions-holiday-resync";
import { ensureUniqueHolidaySlug } from "@/lib/holiday-event-slug";
import { SENTINEL_YEAR_RECURRING } from "@/lib/schedule";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireStaffRead();
  const { id } = await context.params;

  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) return jsonErr("NOT_FOUND", "Feriado não encontrado.", 404);

  return jsonOk({ holiday });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireMaster();
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
  if (!isEvent) {
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
        recurring
          ? "Já existe um feriado recorrente para este dia e mês."
          : "Já existe um feriado para esta data.",
        409
      );
    }
  }

  const effectiveAllowsRegistration = isEvent
    ? (parsed.data.allowsRegistration ?? existing.allowsRegistration)
    : false;
  const effectiveAllowsReferral = effectiveAllowsRegistration
    ? (parsed.data.allowsReferral ?? existing.allowsReferral)
    : false;
  const effectiveName = parsed.data.name !== undefined ? parsed.data.name || null : existing.name;
  const desiredSlug = parsed.data.slug !== undefined ? parsed.data.slug?.trim() || null : undefined;

  let slugValue: string | null | undefined;
  if (!isEvent) {
    slugValue = existing.slug === null ? undefined : null;
  } else if (desiredSlug !== undefined) {
    slugValue = await ensureUniqueHolidaySlug(desiredSlug || effectiveName, id);
  } else if (!existing.slug) {
    slugValue = await ensureUniqueHolidaySlug(effectiveName, id);
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
      ...(parsed.data.allowsRegistration !== undefined || parsed.data.eventStartTime !== undefined || parsed.data.eventEndTime !== undefined
        ? { allowsRegistration: effectiveAllowsRegistration }
        : {}),
      ...(parsed.data.publicDescription !== undefined
        ? { publicDescription: parsed.data.publicDescription?.trim() || null }
        : {}),
      ...(parsed.data.subtitle !== undefined || parsed.data.eventStartTime !== undefined || parsed.data.eventEndTime !== undefined
        ? { subtitle: isEvent ? (parsed.data.subtitle !== undefined ? parsed.data.subtitle?.trim() || null : existing.subtitle) : null }
        : {}),
      ...(slugValue !== undefined ? { slug: slugValue } : {}),
      ...(parsed.data.allowsReferral !== undefined ||
      parsed.data.allowsRegistration !== undefined ||
      parsed.data.eventStartTime !== undefined ||
      parsed.data.eventEndTime !== undefined
        ? {
            allowsReferral: effectiveAllowsReferral,
            requiresReferral: effectiveAllowsReferral
              ? (parsed.data.requiresReferral ?? existing.requiresReferral)
              : false,
          }
        : parsed.data.requiresReferral !== undefined
          ? { requiresReferral: effectiveAllowsReferral ? parsed.data.requiresReferral : false }
          : {}),
      ...(parsed.data.capacity !== undefined
        ? { capacity: isEvent ? (parsed.data.capacity ?? null) : null }
        : {}),
      ...(parsed.data.responsibleTeacherId !== undefined
        ? { responsibleTeacherId: parsed.data.responsibleTeacherId || null }
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
  const user = await requireMaster();
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
