export function isTimedHolidayEvent(h: {
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): boolean {
  return !!(h.eventStartTime?.trim() && h.eventEndTime?.trim());
}

export function canPedagogicalAdminEditHoliday(
  userId: string,
  holiday: { eventStartTime?: string | null; eventEndTime?: string | null },
  createdByUserId: string | null | undefined
): boolean {
  return (
    isTimedHolidayEvent(holiday) &&
    !!createdByUserId &&
    createdByUserId === userId
  );
}

export function serializeHolidayWithCreator<T extends Record<string, unknown>>(
  holiday: T,
  createdByUserId: string | null | undefined
) {
  return { ...holiday, createdByUserId: createdByUserId ?? null };
}
