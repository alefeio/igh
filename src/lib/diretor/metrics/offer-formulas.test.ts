import { describe, expect, it } from "vitest";

import {
  demandCompletionQuadrant,
  isLowOccupancyClass,
  occupancyPercent,
  seatOfferAcceptRate,
  uniqueDemandStudentIds,
} from "@/lib/diretor/metrics/offer-formulas";

describe("oferta — fórmulas", () => {
  it("ocupação atual", () => {
    expect(occupancyPercent(25, 50)).toBe(50);
  });

  it("capacidade zero → não calculável", () => {
    expect(occupancyPercent(3, 0)).toBeNull();
  });

  it("baixa ocupação: vazia ou <30%", () => {
    expect(isLowOccupancyClass(0, 40)).toBe(true);
    expect(isLowOccupancyClass(10, 40)).toBe(true);
    expect(isLowOccupancyClass(20, 40)).toBe(false);
  });

  it("deduplicação waitlist + pré-matrícula", () => {
    const r = uniqueDemandStudentIds({
      preEnrollmentStudentIds: ["a", "b", "a"],
      waitlistWaitingStudentIds: ["b", "c"],
    });
    expect(r.uniqueCount).toBe(3);
  });

  it("taxa de aceite com denominador zero", () => {
    expect(
      seatOfferAcceptRate({ accepted: 0, expired: 0, cancelled: 0 }),
    ).toBeNull();
  });

  it("ofertas aceitas/expiradas/canceladas (pendentes fora do denom)", () => {
    expect(
      seatOfferAcceptRate({ accepted: 2, expired: 1, cancelled: 1 }),
    ).toBe(50);
  });

  it("quadrantes demanda × conclusão", () => {
    expect(
      demandCompletionQuadrant({
        hasClosedCohort: false,
        demandProxy: 100,
        capacity: 50,
        waitlist: 10,
        completionStartedRate: 90,
      }),
    ).toBe("unavailable");
    expect(
      demandCompletionQuadrant({
        hasClosedCohort: true,
        demandProxy: 100,
        capacity: 50,
        waitlist: 5,
        completionStartedRate: 80,
      }),
    ).toBe("expand");
    expect(
      demandCompletionQuadrant({
        hasClosedCohort: true,
        demandProxy: 100,
        capacity: 50,
        waitlist: 5,
        completionStartedRate: 40,
      }),
    ).toBe("review_execution");
  });
});
