import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";

const ALLOWED_FIELDS = [
  "name",
  "cpf",
  "rg",
  "phone",
  "email",
  "birthDate",
  "gender",
  "city",
  "state",
  "street",
  "number",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

function normalizeDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Termos de busca por nome (texto) e CPF (somente dígitos, parcial ou completo). */
function buildStudentSearchOr(q: string): Prisma.StudentWhereInput[] {
  const trimmed = q.trim();
  const digits = normalizeDigits(trimmed);
  const or: Prisma.StudentWhereInput[] = [{ name: { contains: trimmed, mode: "insensitive" } }];

  if (digits.length === 0) {
    return or;
  }

  if (digits.length === 11) {
    or.push({ cpf: digits });
  } else if (digits.length === 10) {
    or.push({ cpf: { startsWith: digits } });
    or.push({ cpf: { contains: digits } });
  } else {
    or.push({ cpf: { contains: digits } });
  }

  if (digits.length === 11) {
    or.push({ guardianCpf: digits });
  } else if (digits.length >= 3) {
    or.push({ guardianCpf: { contains: digits } });
  }

  return or;
}

function formatDateOnlyIso(d: Date | null): string {
  if (!d) return "";
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

function fieldLabel(f: AllowedField): string {
  const labels: Record<AllowedField, string> = {
    name: "Nome",
    cpf: "CPF",
    rg: "RG",
    phone: "Celular",
    email: "E-mail",
    birthDate: "Nascimento",
    gender: "Gênero",
    city: "Cidade",
    state: "UF",
    street: "Rua",
    number: "Número",
  };
  return labels[f];
}

function pickFieldValue(student: any, f: AllowedField): string {
  switch (f) {
    case "name":
      return String(student.name ?? "");
    case "cpf":
      return String(student.cpf ?? "");
    case "rg":
      return String(student.rg ?? "");
    case "phone":
      return String(student.phone ?? "");
    case "email":
      return String(student.email ?? "");
    case "birthDate":
      return student.birthDate ? formatDateOnlyIso(student.birthDate as Date) : "";
    case "gender":
      return String(student.gender ?? "");
    case "city":
      return String(student.city ?? "");
    case "state":
      return String(student.state ?? "");
    case "street":
      return String(student.street ?? "");
    case "number":
      return String(student.number ?? "");
    default:
      return "";
  }
}

function safeFilenameDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER", "COORDINATOR"]);

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "").toLowerCase();
  if (format !== "pdf" && format !== "xlsx") {
    return jsonErr("VALIDATION_ERROR", "Formato inválido. Use pdf ou xlsx.", 400);
  }

  const body = await request.json().catch(() => null);
  const fieldsRaw = Array.isArray(body?.fields) ? (body.fields as unknown[]) : [];
  const q = typeof body?.q === "string" ? body.q.trim() : "";
  const includeDeletedRaw = body?.includeDeleted === true;
  const includeDeleted =
    includeDeletedRaw && (user.role === "MASTER" || user.role === "ADMIN" || user.role === "COORDINATOR");

  const fields = fieldsRaw
    .map((f) => (typeof f === "string" ? f : ""))
    .filter((f): f is AllowedField => (ALLOWED_FIELDS as readonly string[]).includes(f));

  if (fields.length === 0) {
    return jsonErr("VALIDATION_ERROR", "Selecione pelo menos um campo para exportar.", 400);
  }

  const where: Prisma.StudentWhereInput = {};
  if (!includeDeleted) where.deletedAt = null;

  let teacherStudentIds: string[] | null = null;
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      teacherStudentIds = [];
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { classGroup: { teacherId: teacher.id } },
        select: { studentId: true },
        distinct: ["studentId"],
      });
      teacherStudentIds = enrollments.map((e) => e.studentId);
    }
    if (teacherStudentIds.length === 0) {
      return jsonErr("NO_DATA", "Nenhum aluno disponível para exportação.", 404);
    }
  }

  if (q.length > 0) {
    const searchOr = buildStudentSearchOr(q);
    if (teacherStudentIds) {
      where.AND = [{ id: { in: teacherStudentIds } }, { OR: searchOr }];
    } else {
      where.OR = searchOr;
    }
  } else if (teacherStudentIds) {
    where.id = { in: teacherStudentIds };
  }

  const students = await prisma.student.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      name: true,
      cpf: true,
      rg: true,
      phone: true,
      email: true,
      birthDate: true,
      gender: true,
      city: true,
      state: true,
      street: true,
      number: true,
    },
  });

  if (students.length === 0) {
    return jsonErr("NO_DATA", "Nenhum aluno encontrado para exportar com os filtros atuais.", 404);
  }

  const fileDate = safeFilenameDate();

  if (format === "xlsx") {
    const header = fields.map((f) => fieldLabel(f));
    const rows = students.map((s) => fields.map((f) => pickFieldValue(s, f)));

    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Alunos");
    const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const outBytes = Uint8Array.from(out);
    const body = new Blob([outBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return new Response(body, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="alunos-${fileDate}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }

  // PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 40;

  const pageSize = { width: 595.28, height: 841.89 }; // A4 (pt)
  let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - margin;

  const title = "Exportação de Alunos";
  page.drawText(title, { x: margin, y, size: 16, font: fontBold });
  y -= 22;
  page.drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { x: margin, y, size: 10, font });
  y -= 18;

  const headerText = fields.map((f) => fieldLabel(f)).join(" | ");
  page.drawText(headerText, { x: margin, y, size: fontSize, font: fontBold });
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageSize.width - margin, y },
    thickness: 1,
  });
  y -= 14;

  const maxWidth = pageSize.width - margin * 2;
  for (const s of students) {
    const line = fields.map((f) => pickFieldValue(s, f)).join(" | ");
    const chunks: string[] = [];
    let current = "";
    for (const word of line.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      const w = font.widthOfTextAtSize(next, fontSize);
      if (w <= maxWidth) {
        current = next;
      } else {
        if (current) chunks.push(current);
        current = word;
      }
    }
    if (current) chunks.push(current);

    for (const c of chunks) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageSize.width, pageSize.height]);
        y = pageSize.height - margin;
      }
      page.drawText(c, { x: margin, y, size: fontSize, font });
      y -= lineHeight;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const pdfOutBytes = Uint8Array.from(pdfBytes);
  const pdfBody = new Blob([pdfOutBytes], { type: "application/pdf" });
  return new Response(pdfBody, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="alunos-${fileDate}.pdf"`,
      "cache-control": "no-store",
    },
  });
}

