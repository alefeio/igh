import { describe, expect, it } from "vitest";

import { cycleIdsForStaffEnrollmentModals, pickCurrentCycle } from "@/lib/cycles";

describe("ciclos da matrícula interna", () => {
  const olderHidden = { id: "old", cycle: 1, year: 2025, isVisibleForEnrollments: false };
  const latestHidden = { id: "latest", cycle: 2, year: 2026, isVisibleForEnrollments: false };
  const latestVisible = { id: "latest", cycle: 2, year: 2026, isVisibleForEnrollments: true };

  it("escolhe o ciclo de maior ano e número", () => {
    expect(pickCurrentCycle([olderHidden, latestHidden])?.id).toBe("latest");
  });

  it("mantém o último ciclo nos formulários mesmo oculto no site", () => {
    expect(cycleIdsForStaffEnrollmentModals([olderHidden, latestHidden])).toEqual(["latest"]);
  });

  it("não devolve ciclos anteriores ocultos", () => {
    expect(cycleIdsForStaffEnrollmentModals([olderHidden, latestVisible])).toEqual(["latest"]);
  });
});