import { describe, expect, it } from "vitest";

import {
  evaluateWaitlistAlternateOfferEligibility,
  evaluateWelcomeEmailEligibility,
  isConfirmedEnrollment,
  parseWaitlistOfferEntityId,
} from "./transactional-eligibility";

const student = {
  id: "stu-1",
  deletedAt: null as Date | null,
  email: "aluno@example.com",
};

describe("evaluateWelcomeEmailEligibility", () => {
  const enrollment = {
    studentId: "stu-1",
    status: "ACTIVE",
    isPreEnrollment: false,
  };

  it("envia quando aluno existe e matrícula confirmada vigente", () => {
    expect(
      evaluateWelcomeEmailEligibility({
        recipientEmail: "aluno@example.com",
        student,
        enrollment,
      }),
    ).toEqual({ eligible: true });
  });

  it("não envia se o aluno foi excluído", () => {
    const decision = evaluateWelcomeEmailEligibility({
      recipientEmail: "aluno@example.com",
      student: { ...student, deletedAt: new Date("2026-08-01") },
      enrollment,
    });
    expect(decision).toEqual({ eligible: false, reason: "student_deleted" });
  });

  it("não envia se o aluno não existe", () => {
    expect(
      evaluateWelcomeEmailEligibility({
        recipientEmail: "aluno@example.com",
        student: null,
        enrollment,
      }),
    ).toEqual({ eligible: false, reason: "student_missing" });
  });

  it("não envia se não há matrícula confirmada", () => {
    expect(
      evaluateWelcomeEmailEligibility({
        recipientEmail: "aluno@example.com",
        student,
        enrollment: { ...enrollment, status: "CANCELLED" },
      }),
    ).toEqual({ eligible: false, reason: "enrollment_not_confirmed" });
  });

  it("não envia pré-matrícula como boas-vindas de matrícula confirmada", () => {
    expect(
      evaluateWelcomeEmailEligibility({
        recipientEmail: "aluno@example.com",
        student,
        enrollment: { ...enrollment, isPreEnrollment: true },
      }),
    ).toEqual({ eligible: false, reason: "enrollment_not_confirmed" });
  });

  it("não envia se o destinatário não é mais o e-mail do aluno", () => {
    expect(
      evaluateWelcomeEmailEligibility({
        recipientEmail: "antigo@example.com",
        student,
        enrollment,
      }),
    ).toEqual({ eligible: false, reason: "recipient_mismatch" });
  });

  it("não envia se a matrícula passou a outro aluno", () => {
    expect(
      evaluateWelcomeEmailEligibility({
        recipientEmail: "aluno@example.com",
        student,
        enrollment: { ...enrollment, studentId: "outro" },
      }),
    ).toEqual({ eligible: false, reason: "enrollment_student_mismatch" });
  });
});

describe("evaluateWaitlistAlternateOfferEligibility", () => {
  it("envia só se ainda WAITING e sem matrícula confirmada no curso", () => {
    expect(
      evaluateWaitlistAlternateOfferEligibility({
        recipientEmail: "aluno@example.com",
        student,
        waitlistStatus: "WAITING",
        hasConfirmedEnrollmentInCourse: false,
      }),
    ).toEqual({ eligible: true });
  });

  it("não envia se já saiu da waitlist WAITING", () => {
    expect(
      evaluateWaitlistAlternateOfferEligibility({
        recipientEmail: "aluno@example.com",
        student,
        waitlistStatus: "CANCELLED",
        hasConfirmedEnrollmentInCourse: false,
      }),
    ).toEqual({ eligible: false, reason: "waitlist_not_waiting" });
  });

  it("não envia se já tem matrícula confirmada no curso", () => {
    expect(
      evaluateWaitlistAlternateOfferEligibility({
        recipientEmail: "aluno@example.com",
        student,
        waitlistStatus: "WAITING",
        hasConfirmedEnrollmentInCourse: true,
      }),
    ).toEqual({ eligible: false, reason: "already_enrolled" });
  });
});

describe("isConfirmedEnrollment / parseWaitlistOfferEntityId", () => {
  it("ACTIVE sem pré-matrícula é confirmada", () => {
    expect(isConfirmedEnrollment({ status: "ACTIVE", isPreEnrollment: false })).toBe(true);
    expect(isConfirmedEnrollment({ status: "ACTIVE", isPreEnrollment: true })).toBe(false);
    expect(isConfirmedEnrollment({ status: "CANCELLED", isPreEnrollment: false })).toBe(false);
  });

  it("parseia entityId da oferta", () => {
    expect(parseWaitlistOfferEntityId("cg-1:stu-1")).toEqual({
      classGroupId: "cg-1",
      studentId: "stu-1",
    });
    expect(parseWaitlistOfferEntityId("invalido")).toBeNull();
  });
});
