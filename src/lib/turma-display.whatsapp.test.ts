import { describe, expect, it } from "vitest";

import {
  buildClassWhatsappInviteMessage,
  formatDaysFullPt,
  normalizeWhatsappGroupUrl,
} from "@/lib/turma-display";

describe("link do grupo de WhatsApp da turma", () => {
  it("escreve os dias por extenso", () => {
    expect(formatDaysFullPt(["QUI", "TER"])).toBe("terça e quinta");
  });

  it("monta a mensagem de convite com o link do grupo", () => {
    const text = buildClassWhatsappInviteMessage({
      teacherName: "Ana Souza",
      courseName: "Informática",
      startDateLabel: "14/10/2026",
      startTime: "19:00",
      daysOfWeek: ["TER", "QUI"],
      groupUrl: "https://chat.whatsapp.com/AbCdEf",
    });
    expect(text).toContain("Sou o professor Ana Souza");
    expect(text).toContain("curso de Informática");
    expect(text).toContain("Instituto Gustavo Hessel");
    expect(text).toContain("dia 14/10/2026 às 19:00 horas, toda terça e quinta");
    expect(text).toContain("https://chat.whatsapp.com/AbCdEf");
    expect(text.endsWith("Muito obrigado!")).toBe(true);
  });

  it("aceita só o convite chat.whatsapp.com", () => {
    expect(normalizeWhatsappGroupUrl("  https://chat.whatsapp.com/AbCdEf  ").ok).toBe(true);
    expect(normalizeWhatsappGroupUrl("")).toEqual({ ok: true, value: null });
    expect(normalizeWhatsappGroupUrl("https://wa.me/5591999999999").ok).toBe(false);
  });
});
