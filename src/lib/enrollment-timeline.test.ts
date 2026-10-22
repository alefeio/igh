import { describe, expect, it } from "vitest";

import { cancellationTimelineItem } from "@/lib/enrollment-timeline";

const at = (iso: string) => new Date(iso);

describe("cancellationTimelineItem", () => {
  it("não inventa cancelamento em matrícula ativa", () => {
    expect(cancellationTimelineItem({ status: "ACTIVE", historyKinds: [], audits: [] })).toBeNull();
  });

  it("mantém o registro já existente no histórico", () => {
    expect(
      cancellationTimelineItem({
        status: "CANCELLED",
        historyKinds: ["CANCELAMENTO"],
        audits: [{ action: "AUTO_CANCEL_ATTENDANCE", diffJson: "{}", createdAt: at("2026-03-01T12:00:00.000Z") }],
      }),
    ).toBeNull();
  });

  it("usa a primeira alteração de status para cancelada", () => {
    const item = cancellationTimelineItem({
      status: "CANCELLED",
      historyKinds: [],
      audits: [
        {
          action: "UPDATE",
          diffJson: JSON.stringify({ updates: { status: "CANCELLED" } }),
          createdAt: at("2026-04-02T15:00:00.000Z"),
        },
        {
          action: "UPDATE",
          diffJson: JSON.stringify({ updates: { status: "CANCELLED", note: "ajuste" } }),
          createdAt: at("2026-05-02T15:00:00.000Z"),
        },
      ],
    });
    expect(item).toEqual({
      at: "2026-04-02T15:00:00.000Z",
      label: "Cancelamento: matrícula cancelada.",
    });
  });

  it("prefere o cancelamento automático ao e-mail", () => {
    const item = cancellationTimelineItem({
      status: "CANCELLED",
      historyKinds: ["JUSTIFICATIVA"],
      audits: [
        {
          action: "EMAIL_SENT",
          diffJson: JSON.stringify({ type: "enrollment_cancelled" }),
          createdAt: at("2026-04-01T10:00:00.000Z"),
        },
        {
          action: "AUTO_CANCEL_ATTENDANCE",
          diffJson: JSON.stringify({ reason: "4 faltas consecutivas sem justificativa" }),
          createdAt: at("2026-04-01T10:01:00.000Z"),
        },
      ],
    });
    expect(item?.label).toBe("Cancelamento: 4 faltas consecutivas sem justificativa.");
    expect(item?.at).toBe("2026-04-01T10:01:00.000Z");
  });

  it("usa o e-mail quando o aluno cancela e não há auditoria de status", () => {
    const item = cancellationTimelineItem({
      status: "CANCELLED",
      historyKinds: [],
      audits: [
        {
          action: "EMAIL_SENT",
          diffJson: JSON.stringify({ type: "enrollment_cancelled" }),
          createdAt: at("2026-06-10T18:00:00.000Z"),
        },
      ],
    });
    expect(item?.at).toBe("2026-06-10T18:00:00.000Z");
  });

  it("mostra o cancelamento mesmo sem data registrada", () => {
    expect(cancellationTimelineItem({ status: "CANCELLED", historyKinds: [], audits: [] })).toEqual({
      at: "",
      label: "Cancelamento: matrícula cancelada.",
    });
  });
});
