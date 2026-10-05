import { describe, expect, it } from "vitest";

import { enrollmentCountsAsFormado } from "@/lib/enrollment-graduation";

describe("enrollment graduation", () => {
  it("conta formado quando apto a certificado", () => {
    expect(
      enrollmentCountsAsFormado({ status: "ACTIVE", certificateEligible: true }),
    ).toBe(true);
  });

  it("conta formado quando matrícula está concluída", () => {
    expect(enrollmentCountsAsFormado({ status: "COMPLETED", certificateEligible: false })).toBe(
      true,
    );
  });

  it("não conta cancelado mesmo com certificado", () => {
    expect(
      enrollmentCountsAsFormado({ status: "CANCELLED", certificateEligible: true }),
    ).toBe(false);
  });

  it("não conta ativo sem aptidão", () => {
    expect(enrollmentCountsAsFormado({ status: "ACTIVE", certificateEligible: false })).toBe(
      false,
    );
  });
});
