/** Segmento PascalCase sem acentos/espaços (ex.: "Robótica Básica" → "RoboticaBasica"). */
export function toPascalFileSegment(value: string, fallback = "Item"): string {
  const parts = (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("")
    .slice(0, 80);
}

/** Primeiro e último nome concatenados (ex.: "Maria Silva Santos" → "MariaSantos"). */
export function firstAndLastNameSegment(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Aluno";
  if (parts.length === 1) return toPascalFileSegment(parts[0], "Aluno");
  return (
    toPascalFileSegment(parts[0], "Aluno") +
    toPascalFileSegment(parts[parts.length - 1], "")
  );
}

/** Rótulo do contato: `c3-NomeDoCurso-PrimeiroEUltimoNomeDoAluno`. */
export function studentVcfContactLabel(params: {
  cycleNumber: number;
  courseName: string;
  studentName: string;
}): string {
  const cycle = Number.isFinite(params.cycleNumber) && params.cycleNumber > 0 ? params.cycleNumber : 1;
  const course = toPascalFileSegment(params.courseName, "Curso");
  const student = firstAndLastNameSegment(params.studentName);
  return `c${cycle}-${course}-${student}`;
}

/** Nome do arquivo da turma: `c3-NomeDoCurso-Alunos.vcf`. */
export function classGroupVcfFileName(params: {
  cycleNumber: number;
  courseName: string;
}): string {
  const cycle = Number.isFinite(params.cycleNumber) && params.cycleNumber > 0 ? params.cycleNumber : 1;
  const course = toPascalFileSegment(params.courseName, "Curso");
  return `c${cycle}-${course}-Alunos.vcf`;
}

/** Nome do arquivo individual: `c3-NomeDoCurso-PrimeiroEUltimoNomeDoAluno.vcf`. */
export function studentVcfFileName(params: {
  cycleNumber: number;
  courseName: string;
  studentName: string;
}): string {
  return `${studentVcfContactLabel(params)}.vcf`;
}

function escapeVcardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Gera um vCard 3.0; o nome exibido no contato é `displayName` (rótulo cN-Curso-Aluno). */
export function buildStudentVcard(params: {
  /** Nome real do aluno (usado só se `displayName` não for informado). */
  name: string;
  /** Nome do card na agenda (ex.: c3-Robotica-MariaSilva). */
  displayName?: string;
  phone?: string | null;
  email?: string | null;
}): string {
  const realName = params.name.trim() || "Aluno";
  const displayName = (params.displayName ?? realName).trim() || realName;

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVcardValue(displayName)}`,
    `N:${escapeVcardValue(displayName)};;;;`,
  ];

  const phoneDigits = (params.phone ?? "").replace(/\D/g, "");
  if (phoneDigits) {
    const tel = phoneDigits.length >= 10 && !phoneDigits.startsWith("55")
      ? `+55${phoneDigits}`
      : phoneDigits.startsWith("55")
        ? `+${phoneDigits}`
        : phoneDigits;
    lines.push(`TEL;TYPE=CELL:${tel}`);
  }

  const email = (params.email ?? "").trim();
  if (email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVcardValue(email)}`);
  }

  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

/** Junta vários vCards em um único arquivo .vcf. */
export function buildStudentsVcfFile(
  students: Array<{
    name: string;
    displayName?: string;
    phone?: string | null;
    email?: string | null;
  }>,
): string {
  return students.map((s) => buildStudentVcard(s)).join("");
}
