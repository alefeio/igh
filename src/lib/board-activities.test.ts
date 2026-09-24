import { describe, expect, it } from "vitest";
import {
  activityOverlapsPeriod,
  applyStatusSideEffects,
  belemDateParts,
  belemDayStartUtc,
  canEditBoardActivityMain,
  canMoveBoardActivity,
  canTransitionStatus,
  isActivityOverdue,
  isMasterOrAdminRole,
  markTeacherScheduleConflicts,
  parseIsoDateOnly,
  resolveBoardPeriod,
  sessionTimesOverlap,
} from "@/lib/board-activities";

describe("board-activities period", () => {
  it("default range is today when empty", () => {
    const r = resolveBoardPeriod({ from: null, to: null, now: new Date("2026-09-24T15:00:00.000Z") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.from).toBe("2026-09-24");
    expect(r.range.to).toBe("2026-09-24");
  });

  it("rejects inverted range", () => {
    const r = resolveBoardPeriod({ from: "2026-09-25", to: "2026-09-24" });
    expect(r.ok).toBe(false);
  });

  it("rejects range over 31 days", () => {
    const r = resolveBoardPeriod({ from: "2026-09-01", to: "2026-10-05" });
    expect(r.ok).toBe(false);
  });

  it("accepts custom range of exactly 31 days", () => {
    const r = resolveBoardPeriod({ from: "2026-09-01", to: "2026-10-01" });
    expect(r.ok).toBe(true);
  });

  it("uses America/Belem for day boundary (UTC evening still previous Belém day)", () => {
    // 2026-09-24 02:30 UTC = 2026-09-23 23:30 in Belém (UTC-3)
    const parts = belemDateParts(new Date("2026-09-24T02:30:00.000Z"));
    expect(parts).toEqual({ y: 2026, m: 9, d: 23 });
  });
});

describe("board-activities period overlap filter", () => {
  const fromUtc = belemDayStartUtc(2026, 9, 24);
  const toExclusiveUtc = belemDayStartUtc(2026, 9, 25);

  it("includes one-day activity on the filter day", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 24),
        plannedEndAt: null,
        startedAt: null,
        completedAt: null,
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });

  it("includes multi-day activity spanning the filter day", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 20),
        plannedEndAt: belemDayStartUtc(2026, 9, 28),
        startedAt: null,
        completedAt: null,
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });

  it("includes in-progress started before period", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 1),
        plannedEndAt: belemDayStartUtc(2026, 9, 2),
        startedAt: belemDayStartUtc(2026, 9, 10),
        completedAt: null,
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });

  it("includes completed within period", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 1),
        plannedEndAt: null,
        startedAt: belemDayStartUtc(2026, 9, 20),
        completedAt: belemDayStartUtc(2026, 9, 24),
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });
});

describe("board-activities transitions", () => {
  it("allows planned -> in progress", () => {
    expect(canTransitionStatus("PLANNED", "IN_PROGRESS")).toBe(true);
  });
  it("blocks planned -> done", () => {
    expect(canTransitionStatus("PLANNED", "DONE")).toBe(false);
  });
  it("sets startedAt when entering in progress", () => {
    const side = applyStatusSideEffects("PLANNED", "IN_PROGRESS", new Date("2026-09-24T12:00:00Z"));
    expect(side.startedAt?.toISOString()).toBe("2026-09-24T12:00:00.000Z");
  });
  it("clears completedAt on reopen", () => {
    const side = applyStatusSideEffects("DONE", "IN_PROGRESS");
    expect(side.completedAt).toBeNull();
  });
});

describe("board-activities permissions", () => {
  it("only creator or assignee can move; third party cannot (including admin role alone)", () => {
    expect(canMoveBoardActivity({ actorId: "a", creatorId: "a", assigneeId: "b" })).toBe(true);
    expect(canMoveBoardActivity({ actorId: "b", creatorId: "a", assigneeId: "b" })).toBe(true);
    expect(canMoveBoardActivity({ actorId: "admin", creatorId: "a", assigneeId: "b" })).toBe(false);
  });
  it("only creator edits main fields", () => {
    expect(canEditBoardActivityMain({ actorId: "a", creatorId: "a" })).toBe(true);
    expect(canEditBoardActivityMain({ actorId: "b", creatorId: "a" })).toBe(false);
  });
  it("isMasterOrAdminRole covers Master/Admin only", () => {
    expect(isMasterOrAdminRole("MASTER")).toBe(true);
    expect(isMasterOrAdminRole("ADMIN")).toBe(true);
    expect(isMasterOrAdminRole("TEACHER")).toBe(false);
    expect(isMasterOrAdminRole("POLO_COORDINATOR")).toBe(false);
  });
});

describe("board-activities overdue", () => {
  it("marks overdue when planned end before today and not done", () => {
    const start = belemDayStartUtc(2026, 9, 20);
    expect(
      isActivityOverdue({
        status: "IN_PROGRESS",
        plannedStartAt: start,
        plannedEndAt: start,
        now: new Date("2026-09-24T15:00:00.000Z"),
      }),
    ).toBe(true);
  });
  it("done is never overdue", () => {
    const start = belemDayStartUtc(2026, 9, 20);
    expect(
      isActivityOverdue({
        status: "DONE",
        plannedStartAt: start,
        plannedEndAt: start,
        now: new Date("2026-09-24T15:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("parseIsoDateOnly", () => {
  it("parses valid", () => {
    expect(parseIsoDateOnly("2026-09-24")).toEqual({ y: 2026, m: 9, d: 24 });
  });
});

describe("agenda conflict detection", () => {
  it("detects overlapping times for same teacher", () => {
    expect(sessionTimesOverlap("08:00", "10:00", "09:00", "11:00")).toBe(true);
    expect(sessionTimesOverlap("08:00", "09:00", "09:00", "10:00")).toBe(false);
  });

  it("marks conflict and ignores canceled sessions", () => {
    const slots = markTeacherScheduleConflicts([
      {
        date: "2026-09-24",
        startTime: "08:00",
        endTime: "10:00",
        status: "SCHEDULED",
        teachers: [{ id: "t1" }],
        conflict: false,
      },
      {
        date: "2026-09-24",
        startTime: "09:00",
        endTime: "11:00",
        status: "SCHEDULED",
        teachers: [{ id: "t1" }],
        conflict: false,
      },
      {
        date: "2026-09-24",
        startTime: "09:30",
        endTime: "10:30",
        status: "CANCELED",
        teachers: [{ id: "t1" }],
        conflict: false,
      },
    ]);
    expect(slots[0].conflict).toBe(true);
    expect(slots[1].conflict).toBe(true);
    expect(slots[2].conflict).toBe(false);
  });
});
