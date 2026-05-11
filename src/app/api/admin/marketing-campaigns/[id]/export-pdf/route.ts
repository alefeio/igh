import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Helvetica no pdf-lib usa WinAnsi (CP1252) e quebra com emojis/alguns símbolos.
 * Sanitiza para um subconjunto seguro, substituindo símbolos comuns.
 */
function toWinAnsiSafe(input: unknown): string {
  const s = (input ?? "").toString();
  if (!s) return "";
  const normalized = s
    // Remove caracteres fora do BMP (emojis, etc.) que quebram WinAnsi.
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    // Normaliza aspas e traços
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    // Setas e bullets comuns
    .replace(/[→➡➜➔➞➟➠]/g, "->")
    .replace(/[←⬅]/g, "<-")
    .replace(/[↔⬌]/g, "<->")
    .replace(/[•∙]/g, "-")
    // Remove controles estranhos (mantém \t \n \r)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // WinAnsi/CP1252: mantém ASCII + Latin-1; remove o restante.
  return normalized.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = toWinAnsiSafe(text).split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawLabelValue(
  page: PDFPage,
  font: PDFFont,
  x: number,
  y: number,
  maxWidth: number,
  label: string,
  value: string,
  fontSize = 10
) {
  const labelText = `${toWinAnsiSafe(label)}: `;
  page.drawText(labelText, { x, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
  const lx = x + font.widthOfTextAtSize(labelText, fontSize);
  const lines = wrapLines(toWinAnsiSafe(value), font, fontSize, Math.max(20, maxWidth - (lx - x)));
  if (lines.length === 0) return 0;
  page.drawText(lines[0], { x: lx, y, size: fontSize, font, color: rgb(0, 0, 0) });
  let used = 1;
  for (let i = 1; i < lines.length; i++) {
    used++;
    page.drawText(lines[i], { x, y: y - (fontSize + 3) * i, size: fontSize, font, color: rgb(0, 0, 0) });
  }
  return used;
}

export async function GET(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, description: true },
  });
  if (!campaign) return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);

  const responses = await prisma.marketingCampaignResponse.findMany({
    where: { campaignId: id },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      ratingStars: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = 595.28; // A4 portrait
  const height = 841.89;

  let page = pdf.addPage([width, height]);
  let y = height - margin;

  page.drawText("Exportação de avaliações", { x: margin, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
  y -= 22;
  page.drawText(toWinAnsiSafe(campaign.title), { x: margin, y, size: 12, font: fontBold, color: rgb(0, 0, 0) });
  y -= 16;
  if (campaign.description?.trim()) {
    const descLines = wrapLines(toWinAnsiSafe(campaign.description), font, 10, width - margin * 2);
    for (const line of descLines) {
      page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 13;
      if (y < margin + 80) break;
    }
  }
  y -= 6;
  page.drawText(`Total: ${responses.length} resposta(s)`, { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 22;

  const maxWidth = width - margin * 2;

  for (const r of responses) {
    const blockHeightMin = 64;
    if (y < margin + blockHeightMin) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }

    // Separador
    page.drawLine({
      start: { x: margin, y: y + 10 },
      end: { x: width - margin, y: y + 10 },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    const who = `${toWinAnsiSafe(r.user.name)}${r.user.email ? ` (${toWinAnsiSafe(r.user.email)})` : ""}`;
    page.drawText(who, { x: margin, y, size: 11, font: fontBold, color: rgb(0, 0, 0) });
    y -= 16;

    const created = r.createdAt.toISOString().replace("T", " ").slice(0, 19);
    page.drawText(`Corações: ${r.ratingStars}/10    •    Enviado: ${created}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 14;

    const comment = toWinAnsiSafe(r.comment) || "—";
    const usedLines = drawLabelValue(page, font, margin, y, maxWidth, "Comentário", comment, 10);
    y -= Math.max(1, usedLines) * 13 + 10;
  }

  const bytes = await pdf.save();

  const safeSlug = (campaign.slug || "campanha").replace(/[^a-z0-9-_]+/gi, "-");
  const filename = `avaliacoes-${safeSlug}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

