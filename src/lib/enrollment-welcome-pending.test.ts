import { describe, expect, it } from "vitest";

import { enrollmentNeedsWelcomeEmail } from "@/lib/enrollment-welcome-pending";

describe("enrollmentNeedsWelcomeEmail", () => {
  const sent = new Set<string>();

  it("inclui pré-matrícula ativa com e-mail que ainda não recebeu", () => {
    expect(
      enrollmentNeedsWelcomeEmail(
        {
          id: "pre",
          status: "ACTIVE",
          email: "aluno@example.com",
          studentDeleted: false,
        },
        sent,
      ),
    ).toBe(true);
  });

  it("não inclui quem já recebeu, está cancelado, sem e-mail ou excluído", () => {
    const already = new Set(["enviado"]);
    expect(
      enrollmentNeedsWelcomeEmail(
        { id: "enviado", status: "ACTIVE", email: "a@example.com", studentDeleted: false },
        already,
      ),
    ).toBe(false);
    expect(
      enrollmentNeedsWelcomeEmail(
        { id: "x", status: "CANCELLED", email: "a@example.com", studentDeleted: false },
        sent,
      ),
    ).toBe(false);
    expect(
      enrollmentNeedsWelcomeEmail(
        { id: "x", status: "ACTIVE", email: "  ", studentDeleted: false },
        sent,
      ),
    ).toBe(false);
    expect(
      enrollmentNeedsWelcomeEmail(
        { id: "x", status: "ACTIVE", email: "a@example.com", studentDeleted: true },
        sent,
      ),
    ).toBe(false);
  });
});
