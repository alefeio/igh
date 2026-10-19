import { describe, expect, it } from "vitest";

import { enrollmentCountsAsFormado } from "@/lib/enrollment-graduation";

describe("enrollment graduation", () => {
  it("conta formado com certificado e turma encerrada", () => {
    expect(
      enrollmentCountsAsFormado({
        status: "ACTIVE",
        certificateEligible: true,
        classGroupStatus: "ENCERRADA",
      }),
    ).toBe(true);
    expect(
      enrollmentCountsAsFormado({
        status: "COMPLETED",
        certificateEligible: true,
        classClosed: true,
      }),
    ).toBe(true);
  });

  it("não conta enquanto a turma não está encerrada", () => {
    expect(
      enrollmentCountsAsFormado({
        status: "ACTIVE",
        certificateEligible: true,
        classGroupStatus: "EM_ANDAMENTO",
      }),
    ).toBe(false);
    expect(
      enrollmentCountsAsFormado({
        status: "COMPLETED",
        certificateEligible: true,
        classClosed: false,
      }),
    ).toBe(false);
  });

  it("não conta sem o status da turma", () => {
    expect(
      enrollmentCountsAsFormado({ status: "COMPLETED", certificateEligible: true }),
    ).toBe(false);
  });

  it("não conta matrícula concluída sem certificado", () => {
    expect(
      enrollmentCountsAsFormado({
        status: "COMPLETED",
        certificateEligible: false,
        classGroupStatus: "ENCERRADA",
      }),
    ).toBe(false);
  });

  it("não conta cancelado mesmo com certificado e turma encerrada", () => {
    expect(
      enrollmentCountsAsFormado({
        status: "CANCELLED",
        certificateEligible: true,
        classGroupStatus: "ENCERRADA",
      }),
    ).toBe(false);
  });

  it("não conta ativo sem aptidão", () => {
    expect(
      enrollmentCountsAsFormado({
        status: "ACTIVE",
        certificateEligible: false,
        classGroupStatus: "ENCERRADA",
      }),
    ).toBe(false);
  });
});
