import { describe, expect, it } from "vitest";

import {
  canPedagogicalAdminEditHoliday,
  isTimedHolidayEvent,
} from "@/lib/holiday-access-shared";

describe("holiday-access", () => {
  it("identifica evento com horário", () => {
    expect(isTimedHolidayEvent({ eventStartTime: "08:00", eventEndTime: "11:00" })).toBe(true);
    expect(isTimedHolidayEvent({ eventStartTime: "08:00", eventEndTime: null })).toBe(false);
  });

  it("permite edição ao admin pedagógico apenas no próprio evento", () => {
    const event = { eventStartTime: "08:00", eventEndTime: "11:00" };
    expect(canPedagogicalAdminEditHoliday("user-1", event, "user-1")).toBe(true);
    expect(canPedagogicalAdminEditHoliday("user-1", event, "user-2")).toBe(false);
    expect(canPedagogicalAdminEditHoliday("user-1", { eventStartTime: null, eventEndTime: null }, "user-1")).toBe(
      false
    );
  });
});
