import { describe, expect, it } from "vitest";

import {
  forumAttachmentFileName,
  isAllowedForumAttachmentFile,
  isProbablyImageUrl,
  mergeForumImagesIntoHtml,
} from "@/lib/forum-question-content";

describe("anexos do fórum", () => {
  it("reconhece imagens e arquivos comuns", () => {
    expect(isProbablyImageUrl("https://apimg.com.br/aula/foto.png")).toBe(true);
    expect(isProbablyImageUrl("https://apimg.com.br/aula/material.pdf")).toBe(false);
    expect(forumAttachmentFileName("https://apimg.com.br/pasta/resumo%20final.docx")).toBe("resumo final.docx");
  });

  it("bloqueia executáveis e arquivos grandes", () => {
    expect(isAllowedForumAttachmentFile(new File(["x"], "virus.exe", { type: "application/octet-stream" })).ok).toBe(
      false,
    );
    expect(isAllowedForumAttachmentFile(new File(["ok"], "aula.pdf", { type: "application/pdf" })).ok).toBe(true);
  });

  it("embute documentos como link no HTML do professor", () => {
    const html = mergeForumImagesIntoHtml("<p>Olá</p>", [
      "https://apimg.com.br/a.png",
      "https://apimg.com.br/docs/plano.pdf",
    ]);
    expect(html).toContain('<img src="https://apimg.com.br/a.png"');
    expect(html).toContain('<a href="https://apimg.com.br/docs/plano.pdf"');
    expect(html).toContain("plano.pdf");
  });
});
