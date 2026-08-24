import { describe, expect, it } from "vitest";

import {
  mergeFinancialAttachments,
  normalizeFinancialAttachmentInputs,
  primaryAttachmentFields,
} from "@/lib/financeiro-attachments";

describe("mergeFinancialAttachments", () => {
  it("usa a lista de filhos quando existe", () => {
    const merged = mergeFinancialAttachments(
      [
        {
          id: "a1",
          url: "https://cdn.example/fatura.pdf",
          publicId: "p1",
          fileName: "fatura.pdf",
          description: "Fatura",
        },
        {
          id: "a2",
          url: "https://cdn.example/comp.png",
          publicId: "p2",
          fileName: "comp.png",
          description: "Comprovante",
        },
      ],
      {
        attachmentUrl: "https://cdn.example/fatura.pdf",
        attachmentPublicId: "p1",
        attachmentFileName: "fatura.pdf",
      },
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].description).toBe("Fatura");
    expect(merged[1].description).toBe("Comprovante");
  });

  it("cai no anexo legado quando ainda não há filhos", () => {
    const merged = mergeFinancialAttachments([], {
      attachmentUrl: "https://cdn.example/nota.pdf",
      attachmentPublicId: "pid",
      attachmentFileName: "nota.pdf",
    });
    expect(merged).toEqual([
      {
        id: "legacy",
        url: "https://cdn.example/nota.pdf",
        publicId: "pid",
        fileName: "nota.pdf",
        description: "nota.pdf",
      },
    ]);
  });
});

describe("normalizeFinancialAttachmentInputs", () => {
  it("prioriza o array de anexos", () => {
    const items = normalizeFinancialAttachmentInputs(
      [
        {
          url: "https://cdn.example/a.pdf",
          publicId: null,
          fileName: "a.pdf",
          description: "Fatura",
        },
      ],
      { attachmentUrl: "https://cdn.example/old.pdf", attachmentFileName: "old.pdf" },
    );
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe("Fatura");
  });

  it("monta um item a partir do campo único legado", () => {
    const items = normalizeFinancialAttachmentInputs(undefined, {
      attachmentUrl: "https://cdn.example/old.pdf",
      attachmentFileName: "old.pdf",
    });
    expect(items[0]).toMatchObject({ url: "https://cdn.example/old.pdf", description: "old.pdf" });
  });
});

describe("primaryAttachmentFields", () => {
  it("espelha o primeiro anexo nos campos legados", () => {
    expect(
      primaryAttachmentFields([
        { url: "https://a", publicId: "1", fileName: "a.pdf", description: "Fatura" },
        { url: "https://b", publicId: "2", fileName: "b.pdf", description: "Comprovante" },
      ]),
    ).toEqual({
      attachmentUrl: "https://a",
      attachmentPublicId: "1",
      attachmentFileName: "a.pdf",
    });
  });
});
