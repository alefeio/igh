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
