import { describe, expect, it } from "vitest";

import { isDirectorDashboardV2Enabled } from "@/lib/diretor/dashboard-v2-flag";

describe("flag redirect DIRECTOR", () => {
  function withFlag(value: string | undefined, fn: () => void) {
    const prev = process.env.DIRECTOR_DASHBOARD_V2_ENABLED;
    try {
      if (value === undefined) delete process.env.DIRECTOR_DASHBOARD_V2_ENABLED;
      else process.env.DIRECTOR_DASHBOARD_V2_ENABLED = value;
      fn();
    } finally {
      if (prev === undefined) delete process.env.DIRECTOR_DASHBOARD_V2_ENABLED;
      else process.env.DIRECTOR_DASHBOARD_V2_ENABLED = prev;
    }
  }

  it("ausente, false e outros valores ficam desligados; só true liga", () => {
    withFlag(undefined, () => expect(isDirectorDashboardV2Enabled()).toBe(false));
    withFlag("false", () => expect(isDirectorDashboardV2Enabled()).toBe(false));
    withFlag("FALSE", () => expect(isDirectorDashboardV2Enabled()).toBe(false));
    withFlag("1", () => expect(isDirectorDashboardV2Enabled()).toBe(false));
    withFlag("TRUE", () => expect(isDirectorDashboardV2Enabled()).toBe(false));
    withFlag("yes", () => expect(isDirectorDashboardV2Enabled()).toBe(false));
    withFlag("true", () => expect(isDirectorDashboardV2Enabled()).toBe(true));
  });
});
