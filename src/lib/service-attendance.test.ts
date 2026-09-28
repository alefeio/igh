import { describe, expect, it } from "vitest";
import { formatBrazilPhoneMask } from "@/lib/service-attendance";
import { serviceAttendanceSchema } from "@/lib/validators/service-attendance";

describe("avaliação de atendimento", () => {
  it("formata o telefone com DDD", () => {
    expect(formatBrazilPhoneMask("91")).toBe("(91");
    expect(formatBrazilPhoneMask("9133334444")).toBe("(91) 3333-4444");
    expect(formatBrazilPhoneMask("91988887777")).toBe("(91) 98888-7777");
  });

  it("exige só nota e canal", () => {
    const parsed = serviceAttendanceSchema.safeParse({ score: 5, channel: "WHATSAPP" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBeNull();
      expect(parsed.data.phone).toBeNull();
    }
  });

  it("rejeita telefone sem DDD completo", () => {
    const parsed = serviceAttendanceSchema.safeParse({
      score: 2,
      channel: "PRESENCIAL",
      phone: "(91) 333",
    });
    expect(parsed.success).toBe(false);
  });

  it("aceita a avaliação mesmo com o campo escondido vazio", () => {
    const parsed = serviceAttendanceSchema.safeParse({
      score: 3,
      channel: "SITE",
      website: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("guarda o telefone só com dígitos", () => {
    const parsed = serviceAttendanceSchema.safeParse({
      score: 4,
      channel: "TELEFONE",
      email: "ana@exemplo.com",
      phone: "(91) 98888-7777",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBe("91988887777");
  });
});
