import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateCourseCompletionCertificatePdfBytes } from "@/lib/course-completion-certificate";

describe("PDF compacto do lote de certificados", () => {
  const input = {
    studentName: "José Álvares da Conceição",
    courseName: "Informática Básica (10h)",
    workloadHours: 10,
    moduleTitles: ["Planilhas", "Internet"],
    teacherName: "Ana Souza",
    teacherSignatureUrl: null,
    issuedAt: new Date("2026-10-01T00:00:00.000Z"),
    issueCity: "Belém",
    issueCityState: "Belém/PA",
  };

  it("mantém o PDF legível e menor ao embutir só os glifos usados", async () => {
    const full = await generateCourseCompletionCertificatePdfBytes(input, { pages: "both" });
    const compact = await generateCourseCompletionCertificatePdfBytes(input, {
      pages: "both",
      compact: true,
    });
    expect(full.byteLength).toBeGreaterThan(10_000);
    expect(compact.byteLength).toBeGreaterThan(10_000);
    expect(compact.byteLength).toBeLessThan(full.byteLength);
  }, 30_000);
});
