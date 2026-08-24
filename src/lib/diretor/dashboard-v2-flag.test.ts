import { describe, expect, it } from "vitest";

import { isDirectorDashboardV2Enabled } from "@/lib/diretor/dashboard-v2-flag";

describe("flag redirect DIRECTOR", () => {
  it("desligada por padrão", () => {
    const prev = process.env.DIRECTOR_DASHBOARD_V2_ENABLED;
    delete process.env.DIRECTOR_DASHBOARD_V2_ENABLED;
    expect(isDirectorDashboardV2Enabled()).toBe(false);
    process.env.DIRECTOR_DASHBOARD_V2_ENABLED = "false";
    expect(isDirectorDashboardV2Enabled()).toBe(false);
    process.env.DIRECTOR_DASHBOARD_V2_ENABLED = "true";
    expect(isDirectorDashboardV2Enabled()).toBe(true);
    if (prev === undefined) delete process.env.DIRECTOR_DASHBOARD_V2_ENABLED;
    else process.env.DIRECTOR_DASHBOARD_V2_ENABLED = prev;
  });
});
