import { prisma } from "@/lib/prisma";
import { requireStaffRead } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

type ExportBody = {
  includeContentRich?: boolean;
  selections: Array<{
    courseId: string;
    lessonIds: string[];
  }>;
};

function sanitizeWinAnsiText(input: string): string {
  const s = (input ?? "").toString();
  if (!s) return "";
  const normalized = s
    // Remove caracteres fora do BMP (emojis, etc.) que quebram WinAnsi.
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    // Normaliza aspas e traços para equivalentes simples
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    // Símbolos frequentes em conteúdo rich text
    .replace(/[→➡➜➔➞➟➠]/g, "->")
    .replace(/[←⬅]/g, "<-")
    .replace(/[↔⬌]/g, "<->")
    .replace(/[•∙]/g, "-")
    // Remove controles estranhos (mantém \t \n \r)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  // WinAnsi/CP1252: mantém ASCII + Latin-1; remove o restante.
  return normalized.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function toTextFromRichHtml(html: string): string {
  const s = (html ?? "").trim();
  if (!s) return "";
  // Renderização simples para PDF: remove tags, preserva quebras básicas.
  return sanitizeWinAnsiText(
    s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<li\s*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function uniqNonEmpty(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = (v ?? "").toString().trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function formatDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function safeFilename(name: string): string {
  return (name ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function buildCourseLessonPlanPdf(args: {
  courseName: string;
  workloadHours: number | null;
  modules: Array<{
    title: string;
    order: number;
    lessons: Array<{
      id: string;
      title: string;
      order: number;
      durationMinutes: number | null;
      summary: string | null;
      contentRich: string | null;
      pdfUrl: string | null;
      attachmentUrls: string[];
      attachmentNames: string[];
    }>;
  }>;
  selectedLessonIds: Set<string>;
  includeContentRich: boolean;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageMargin = 48;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89; // A4
  const maxWidth = pageWidth - pageMargin * 2;
  const lineHeight = 14;
  const smallLineHeight = 12;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - pageMargin;

  function newPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - pageMargin;
  }

  function drawLine(text: string, opts?: { bold?: boolean; size?: number; extraSpacingAfter?: number }) {
    const size = opts?.size ?? 11;
    const bold = opts?.bold ?? false;
    const fontToUse = bold ? fontBold : font;
    const lh = size <= 10 ? smallLineHeight : lineHeight;

    const safe = sanitizeWinAnsiText((text ?? "").toString());
    const words = safe.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      y -= lh;
      if (y < pageMargin + lh) newPage();
      if (opts?.extraSpacingAfter) y -= opts.extraSpacingAfter;
      return;
    }

    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      const width = fontToUse.widthOfTextAtSize(next, size);
      if (width <= maxWidth) {
        line = next;
        continue;
      }
      // desenha linha atual
      page.drawText(line, { x: pageMargin, y, size, font: fontToUse });
      y -= lh;
      if (y < pageMargin + lh) newPage();
      line = w;
    }
    if (line) {
      page.drawText(line, { x: pageMargin, y, size, font: fontToUse });
      y -= lh;
      if (y < pageMargin + lh) newPage();
    }
    if (opts?.extraSpacingAfter) {
      y -= opts.extraSpacingAfter;
      if (y < pageMargin + lh) newPage();
    }
  }

  // Capa
  drawLine("Plano de aula", { bold: true, size: 22, extraSpacingAfter: 10 });
  drawLine(args.courseName, { bold: true, size: 16, extraSpacingAfter: 6 });
  if (args.workloadHours != null) drawLine(`Carga horária: ${args.workloadHours}h`, { size: 11, extraSpacingAfter: 2 });
  drawLine(`Gerado em: ${formatDateBR(new Date())}`, { size: 11, extraSpacingAfter: 14 });

  drawLine("Sumário (aulas selecionadas)", { bold: true, size: 13, extraSpacingAfter: 6 });
  for (const mod of args.modules) {
    const modLessons = mod.lessons.filter((l) => args.selectedLessonIds.has(l.id));
    if (modLessons.length === 0) continue;
    drawLine(`Módulo ${mod.order + 1}: ${mod.title}`, { bold: true, size: 11, extraSpacingAfter: 2 });
    for (const les of modLessons) {
      drawLine(`- Aula ${les.order + 1}: ${les.title}`, { size: 10 });
    }
    drawLine("", { extraSpacingAfter: 6 });
  }

  // Conteúdo detalhado
  drawLine("Detalhamento das aulas", { bold: true, size: 13, extraSpacingAfter: 6 });

  for (const mod of args.modules) {
    const modLessons = mod.lessons.filter((l) => args.selectedLessonIds.has(l.id));
    if (modLessons.length === 0) continue;

    drawLine(`Módulo ${mod.order + 1}: ${mod.title}`, { bold: true, size: 12, extraSpacingAfter: 4 });

    for (const les of modLessons) {
      drawLine(`Aula ${les.order + 1}: ${les.title}`, { bold: true, size: 11, extraSpacingAfter: 2 });
      if (les.durationMinutes != null) drawLine(`Duração: ${les.durationMinutes} min`, { size: 10, extraSpacingAfter: 2 });

      const summary = (les.summary ?? "").trim();
      if (summary) {
        drawLine("Resumo:", { bold: true, size: 10 });
        drawLine(summary, { size: 10, extraSpacingAfter: 4 });
      }

      if (args.includeContentRich) {
        const content = toTextFromRichHtml(les.contentRich ?? "");
        if (content) {
          drawLine("Conteúdo:", { bold: true, size: 10 });
          for (const chunk of content.split("\n")) {
            drawLine(chunk.trim(), { size: 10 });
          }
          drawLine("", { extraSpacingAfter: 4 });
        }
      }

      const materialLines = uniqNonEmpty([
        les.pdfUrl?.trim() ? `Material PDF da aula: ${les.pdfUrl.trim()}` : null,
        ...((les.attachmentUrls ?? []).map((url, idx) => {
          const u = (url ?? "").trim();
          if (!u) return null;
          const label = (les.attachmentNames ?? [])[idx]?.trim() || "Anexo";
          return `${label}: ${u}`;
        })),
      ]);
      if (materialLines.length > 0) {
        drawLine("Materiais:", { bold: true, size: 10 });
        for (const line of materialLines) drawLine(`- ${line}`, { size: 10 });
        drawLine("", { extraSpacingAfter: 6 });
      } else {
        drawLine("", { extraSpacingAfter: 6 });
      }
    }
  }

  return await pdf.save();
}

export async function POST(request: Request) {
  await requireStaffRead();

  const body = (await request.json().catch(() => null)) as ExportBody | null;
  if (!body || !Array.isArray(body.selections) || body.selections.length === 0) {
    return jsonErr("VALIDATION_ERROR", "Selecione pelo menos um curso.", 400);
  }

  const includeContentRich = !!body.includeContentRich;
  const selections = body.selections
    .map((s) => ({
      courseId: (s?.courseId ?? "").trim(),
      lessonIds: Array.isArray(s?.lessonIds) ? s.lessonIds.map((x) => String(x).trim()).filter(Boolean) : [],
    }))
    .filter((s) => s.courseId && s.lessonIds.length > 0);

  if (selections.length === 0) {
    return jsonErr("VALIDATION_ERROR", "Selecione pelo menos uma aula em pelo menos um curso.", 400);
  }

  const courseIds = selections.map((s) => s.courseId);
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      id: true,
      name: true,
      workloadHours: true,
      modules: {
        orderBy: { order: "asc" },
        select: {
          title: true,
          order: true,
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              durationMinutes: true,
              summary: true,
              contentRich: true,
              pdfUrl: true,
              attachmentUrls: true,
              attachmentNames: true,
            },
          },
        },
      },
    },
  });

  const byId = new Map(courses.map((c) => [c.id, c]));
  const zip = new JSZip();
  const missing: string[] = [];

  for (const sel of selections) {
    const c = byId.get(sel.courseId);
    if (!c) {
      missing.push(sel.courseId);
      continue;
    }
    const selectedLessonIds = new Set(sel.lessonIds);
    const pdfBytes = await buildCourseLessonPlanPdf({
      courseName: c.name,
      workloadHours: c.workloadHours ?? null,
      modules: c.modules.map((m) => ({
        title: m.title,
        order: m.order,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          order: l.order,
          durationMinutes: l.durationMinutes,
          summary: l.summary ?? null,
          contentRich: l.contentRich ?? null,
          pdfUrl: l.pdfUrl ?? null,
          attachmentUrls: l.attachmentUrls ?? [],
          attachmentNames: l.attachmentNames ?? [],
        })),
      })),
      selectedLessonIds,
      includeContentRich,
    });

    const filename = `${safeFilename(c.name)} - Plano de aula.pdf`;
    zip.file(filename, pdfBytes);
  }

  if (missing.length > 0) {
    zip.file("AVISO.txt", `Alguns cursos não foram encontrados no banco: ${missing.join(", ")}\n`);
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const out = Uint8Array.from(zipBytes);
  const blob = new Blob([out], { type: "application/zip" });

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=\"planos-de-aula.zip\"`,
      "Cache-Control": "no-store",
    },
  });
}

