import { slugPart } from "@/lib/course-certificate-pdf-naming";

/**
 * Margem sob o limite de ~4,5 MB da resposta na Vercel.
 * O ZIP do ciclo inteiro não cabe numa função só.
 */
export const CYCLE_CERTIFICATE_ZIP_MAX_BYTES = 3_200_000;

/** Teto de PDFs por requisição, para a função não estourar o tempo. */
export const CYCLE_CERTIFICATE_ZIP_MAX_FILES = 12;

export function shouldAcceptNextCertificate(input: {
  includedBytes: number;
  includedCount: number;
  nextBytes: number;
  maxBytes?: number;
  maxCount?: number;
}): boolean {
  const maxBytes = input.maxBytes ?? CYCLE_CERTIFICATE_ZIP_MAX_BYTES;
  const maxCount = input.maxCount ?? CYCLE_CERTIFICATE_ZIP_MAX_FILES;
  if (input.includedCount <= 0) return true;
  if (input.includedCount >= maxCount) return false;
  return input.includedBytes + input.nextBytes <= maxBytes;
}

/** Nome estável entre lotes (o id evita homônimo de outra parte sobrescrever no ZIP final). */
export function cycleCertificatePdfFileName(studentName: string, enrollmentId: string): string {
  const base = slugPart(studentName, "aluno");
  const suffix = enrollmentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase() || "id";
  return `${base}-${suffix}.pdf`;
}
