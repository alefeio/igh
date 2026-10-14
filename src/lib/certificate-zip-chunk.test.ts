import { describe, expect, it } from "vitest";

import {
  cycleCertificatePdfFileName,
  shouldAcceptNextCertificate,
} from "@/lib/certificate-zip-chunk";

describe("lotes do ZIP de certificados do ciclo", () => {
  it("sempre aceita o primeiro arquivo e para no limite de tamanho ou quantidade", () => {
    expect(
      shouldAcceptNextCertificate({
        includedBytes: 0,
        includedCount: 0,
        nextBytes: 9_000_000,
        maxBytes: 100,
        maxCount: 2,
      }),
    ).toBe(true);
    expect(
      shouldAcceptNextCertificate({
        includedBytes: 80,
        includedCount: 1,
        nextBytes: 30,
        maxBytes: 100,
        maxCount: 5,
      }),
    ).toBe(false);
    expect(
      shouldAcceptNextCertificate({
        includedBytes: 10,
        includedCount: 2,
        nextBytes: 10,
        maxBytes: 1000,
        maxCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldAcceptNextCertificate({
        includedBytes: 40,
        includedCount: 1,
        nextBytes: 50,
        maxBytes: 100,
        maxCount: 5,
      }),
    ).toBe(true);
  });

  it("diferencia homônimos pelo id da matrícula", () => {
    const a = cycleCertificatePdfFileName("Maria Souza", "aaaaaaaa-1111");
    const b = cycleCertificatePdfFileName("Maria Souza", "bbbbbbbb-2222");
    expect(a).not.toBe(b);
    expect(a.endsWith(".pdf")).toBe(true);
    expect(a).toContain("maria-souza");
  });
});
