-- Idempotente: mesma alteração que 20260328120000_holiday_event_times (evita P3018 se já aplicada).
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "eventStartTime" TEXT;
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "eventEndTime" TEXT;
