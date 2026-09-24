import { describe, expect, it } from "vitest";

import {
  getBoardActivitiesGateStatus,
  isBoardActivitiesNavVisible,
  boardActivitiesAdminHint,
} from "@/lib/board-activities-flag";

describe("board-activities feature gate", () => {
  function withEnv(
    values: {
      enabled?: string | undefined;
      unitId?: string | undefined;
    },
    fn: () => void,
  ) {
    const prevEnabled = process.env.BOARD_ACTIVITIES_ENABLED;
    const prevUnit = process.env.BOARD_ACTIVITIES_POLO_LOCATION_ID;
    try {
      if (values.enabled === undefined) delete process.env.BOARD_ACTIVITIES_ENABLED;
      else process.env.BOARD_ACTIVITIES_ENABLED = values.enabled;
      if (values.unitId === undefined) delete process.env.BOARD_ACTIVITIES_POLO_LOCATION_ID;
      else process.env.BOARD_ACTIVITIES_POLO_LOCATION_ID = values.unitId;
      fn();
    } finally {
      if (prevEnabled === undefined) delete process.env.BOARD_ACTIVITIES_ENABLED;
      else process.env.BOARD_ACTIVITIES_ENABLED = prevEnabled;
      if (prevUnit === undefined) delete process.env.BOARD_ACTIVITIES_POLO_LOCATION_ID;
      else process.env.BOARD_ACTIVITIES_POLO_LOCATION_ID = prevUnit;
    }
  }

  const validUnit = "a1b2c3d4-e5f6-4718-9abc-def012345678";

  it("desativado por padrão e com valores diferentes de true", () => {
    withEnv({ enabled: undefined, unitId: validUnit }, () => {
      expect(getBoardActivitiesGateStatus()).toEqual({ active: false, reason: "disabled" });
      expect(isBoardActivitiesNavVisible()).toBe(false);
    });
    withEnv({ enabled: "TRUE", unitId: validUnit }, () => {
      expect(getBoardActivitiesGateStatus().active).toBe(false);
    });
    withEnv({ enabled: "1", unitId: validUnit }, () => {
      expect(getBoardActivitiesGateStatus().active).toBe(false);
    });
  });

  it("exige unidade UUID quando ENABLED=true", () => {
    withEnv({ enabled: "true", unitId: undefined }, () => {
      expect(getBoardActivitiesGateStatus()).toEqual({ active: false, reason: "missing_unit" });
      expect(boardActivitiesAdminHint("missing_unit")).toMatch(/POLO_LOCATION_ID/);
    });
    withEnv({ enabled: "true", unitId: "nao-e-uuid" }, () => {
      expect(getBoardActivitiesGateStatus()).toEqual({
        active: false,
        reason: "invalid_unit_format",
      });
    });
  });

  it("ativa somente com ENABLED=true e UUID válido", () => {
    withEnv({ enabled: "true", unitId: validUnit }, () => {
      expect(getBoardActivitiesGateStatus()).toEqual({ active: true, unitId: validUnit });
      expect(isBoardActivitiesNavVisible()).toBe(true);
    });
  });
});
