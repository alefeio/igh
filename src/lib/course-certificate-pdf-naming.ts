import { PDFDocument } from "pdf-lib";

export type CertificateZipPages = "front" | "both";

export function parseCertificateZipPages(value: string | null | undefined): CertificateZipPages {
  return value === "front" ? "front" : "both";
}

export function slugPart(value: string, fallback = "item"): string {
  return (value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

/** Nome do PDF no ZIP: `nome-do-aluno.pdf` (com sufixo se houver homônimos). */
export function studentCertificatePdfFileName(studentName: string, usedNames: Set<string>): string {
  const base = slugPart(studentName, "aluno");
  let fileName = `${base}.pdf`;
  let n = 2;
  while (usedNames.has(fileName)) {
    fileName = `${base}-${n}.pdf`;
    n += 1;
  }
  usedNames.add(fileName);
  return fileName;
}

export async function sliceCertificatePdfPages(
  pdfBytes: Uint8Array,
  pages: CertificateZipPages,
): Promise<Uint8Array> {
  if (pages === "both") return pdfBytes;
  const source = await PDFDocument.load(pdfBytes);
  if (source.getPageCount() <= 1) return pdfBytes;
  const target = await PDFDocument.create();
  const [first] = await target.copyPages(source, [0]);
  target.addPage(first);
  return target.save();
}
