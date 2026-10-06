import { describe, expect, it } from "vitest";

import {
  buildJourneySlices,
  buildPanelInsight,
  plainFunnelLabel,
  plainRetentionLabel,
  toneForAttendance,
  toneForRiskCount,
} from "@/components/coordenacao/coordinator-copy";

describe("coordinator-copy", () => {
  it("traduz jargão do funil para linguagem pedagógica", () => {
    expect(plainFunnelLabel("Confirmada na coorte")).toBe("Matrícula confirmada");
    expect(plainFunnelLabel("Matrícula confirmada")).toBe("Matrícula confirmada");
    expect(plainRetentionLabel("Início")).toBe("No início (já frequentaram)");
    expect(plainRetentionLabel("Conclusão da frequência")).toBe("Conclusão");
  });

  it("monta fatias da jornada sem zeros", () => {
    const slices = buildJourneySlices({
      enrollments: 10,
      started: 6,
      atRisk: 2,
      noShow: 2,
      earlyDropout: 1,
      dropout: 1,
      completed: 2,
    });
    expect(slices.every((slice) => slice.value > 0)).toBe(true);
    expect(slices.some((slice) => slice.name === "Não compareceram")).toBe(true);
    expect(slices.some((slice) => slice.name === "Saiu no começo")).toBe(true);
  });

  it("prioriza atenção no insight quando há alunos em risco", () => {
    const insight = buildPanelInsight(
      {
        enrollments: 20,
        started: 15,
        atRisk: 3,
        noShow: 1,
        earlyDropout: 0,
        dropout: 1,
        completed: 4,
      },
      {
        attendanceRate: { value: 62, available: true },
        dropoutRate: { value: 8, available: true },
        completionRate: { value: 27, available: true },
        startedRate: { value: 80, available: true },
        noShowRate: { value: 5, available: true },
      },
    );
    expect(insight.bullets[0]).toMatch(/precisam de atenção|precisa de atenção/);
    expect(insight.tone === "warning" || insight.tone === "critical").toBe(true);
    expect(insight.bullets.length).toBeLessThanOrEqual(3);
  });

  it("define tons de frequência e risco", () => {
    expect(toneForAttendance(80)).toBe("ok");
    expect(toneForAttendance(55)).toBe("warning");
    expect(toneForAttendance(40)).toBe("critical");
    expect(toneForRiskCount(0)).toBe("ok");
    expect(toneForRiskCount(3)).toBe("warning");
    expect(toneForRiskCount(8)).toBe("critical");
  });
});
