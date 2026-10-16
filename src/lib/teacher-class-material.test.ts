import { describe, expect, it } from "vitest";

import {
  MaterialUrlError,
  assertPublicHttpsUrl,
  contentDisposition,
  officePresentationEmbedUrl,
  teacherMaterialClassLabel,
  teacherMaterialKind,
  toTeacherMaterialDto,
} from "@/lib/teacher-class-material";

describe("material do professor", () => {
  it("classifica pdf e powerpoint pelo nome e pelo tipo", () => {
    expect(teacherMaterialKind("Aula.pdf", null)).toBe("pdf");
    expect(teacherMaterialKind("roteiro.PPTX", "application/octet-stream")).toBe("ppt");
    expect(teacherMaterialKind("notas.docx", "application/pdf")).toBe("pdf");
    expect(teacherMaterialKind("planilha.xlsx", null)).toBe("other");
  });

  it("monta o visualizador do PowerPoint com a URL codificada", () => {
    expect(officePresentationEmbedUrl("https://apimg.com.br/a.pptx?x=1")).toBe(
      "https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fapimg.com.br%2Fa.pptx%3Fx%3D1"
    );
  });

  it("recusa endereços que não são HTTPS públicos", () => {
    expect(() => assertPublicHttpsUrl("http://apimg.com.br/a.pdf")).toThrow(MaterialUrlError);
    expect(() => assertPublicHttpsUrl("https://127.0.0.1/a.pdf")).toThrow(MaterialUrlError);
    expect(() => assertPublicHttpsUrl("https://192.168.0.8/a.pdf")).toThrow(MaterialUrlError);
    expect(assertPublicHttpsUrl("https://apimg.com.br/igh/aula.pdf")).toBe(
      "https://apimg.com.br/igh/aula.pdf"
    );
  });

  it("identifica a turma de outro professor pelos dias e pelo horário", () => {
    expect(
      teacherMaterialClassLabel({ daysOfWeek: ["QUI", "TER"], startTime: "19:00", endTime: "21:00" })
    ).toBe("ter e qui · 19:00–21:00");
  });

  it("marca se o arquivo é da turma aberta", () => {
    const row = {
      id: "m1",
      fileName: "aula.pdf",
      url: "https://apimg.com.br/aula.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      createdAt: new Date("2026-10-16T12:00:00.000Z"),
    };
    expect(toTeacherMaterialDto(row, { fromThisClass: true }).fromThisClass).toBe(true);
    expect(toTeacherMaterialDto(row).fromThisClass).toBe(false);
  });

  it("força download no cabeçalho quando pedido", () => {
    expect(contentDisposition("Aula 1.pdf", true)).toContain("attachment;");
    expect(contentDisposition("Aula 1.pdf", false)).toContain("inline;");
  });
});
