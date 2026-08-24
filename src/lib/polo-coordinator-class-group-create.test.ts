import { describe, expect, it } from "vitest";

import { pickCurrentCycle } from "@/lib/cycles";
import {
  isPoloCoordinatorIntroInformaticaCourse,
  poloCoordinatorCreateClassGroupError,
} from "@/lib/polo-coordinator-class-group-create";

describe("criação de turma pelo coordenador de polo", () => {
  const current = { id: "cur", cycle: 2, year: 2026 };
  const cycles = [
    { id: "old", cycle: 1, year: 2025 },
    current,
    { id: "older", cycle: 1, year: 2026 },
  ];

  it("ciclo atual é o de maior ano/número", () => {
    expect(pickCurrentCycle(cycles)?.id).toBe("cur");
  });

  it("reconhece Introdução à Informática (10h) pelo nome ou pela carga", () => {
    expect(isPoloCoordinatorIntroInformaticaCourse({ name: "Introdução à Informática (10h)" })).toBe(true);
    expect(isPoloCoordinatorIntroInformaticaCourse({ name: "Introdução à Informática", workloadHours: 10 })).toBe(
      true,
    );
    expect(isPoloCoordinatorIntroInformaticaCourse({ name: "Excel", workloadHours: 10 })).toBe(false);
    expect(isPoloCoordinatorIntroInformaticaCourse({ name: "Introdução à Informática", workloadHours: 40 })).toBe(
      false,
    );
  });

  it("rejeita ciclo, curso ou tipo internos", () => {
    const intro = { name: "Introdução à Informática", workloadHours: 10 };
    expect(
      poloCoordinatorCreateClassGroupError({
        cycleId: "old",
        currentCycleId: "cur",
        course: intro,
        isExternal: true,
      }),
    ).toMatch(/ciclo atual/);
    expect(
      poloCoordinatorCreateClassGroupError({
        cycleId: "cur",
        currentCycleId: "cur",
        course: { name: "Outro", workloadHours: 10 },
        isExternal: true,
      }),
    ).toMatch(/Introdução à Informática/);
    expect(
      poloCoordinatorCreateClassGroupError({
        cycleId: "cur",
        currentCycleId: "cur",
        course: intro,
        isExternal: false,
      }),
    ).toMatch(/Externa/);
    expect(
      poloCoordinatorCreateClassGroupError({
        cycleId: "cur",
        currentCycleId: "cur",
        course: intro,
        isExternal: true,
      }),
    ).toBeNull();
  });
});
