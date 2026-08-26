import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { resolveDonationPdfUrl } from "@/lib/donation-attachments";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

function safeFileName(name: string): string {
  return name.replace(/[\r\n"]/g, "").trim().slice(0, 180) || "termo-doacao.pdf";
}

/** Proxy do PDF do termo: inline (visualizar) ou attachment (download=1). */
export async function GET(request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "1";
  const attachmentId = searchParams.get("attachmentId");

  const donation = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    select: {
      pdfUrl: true,
      termNumber: true,
      donataria: { select: { name: true } },
      attachments: {
        select: { id: true, url: true, kind: true, fileName: true, description: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!donation) {
    return jsonErr("NOT_FOUND", "Doação não encontrada.", 404);
  }

  let pdfUrl: string | null = null;
  let labelHint = "termo-doacao";

  if (attachmentId) {
    const att = donation.attachments.find((a) => a.id === attachmentId);
    if (!att) return jsonErr("NOT_FOUND", "Anexo não encontrado.", 404);
    pdfUrl = att.url;
    labelHint = att.fileName || att.description || labelHint;
  } else {
    pdfUrl = resolveDonationPdfUrl({
      pdfUrl: donation.pdfUrl,
      attachments: donation.attachments,
    });
  }

  if (!pdfUrl) {
    return jsonErr("NOT_FOUND", "PDF do termo não encontrado.", 404);
  }

  const upstream = await fetch(pdfUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return jsonErr("FETCH_FAILED", "Não foi possível obter o PDF do termo.", 502);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const termLabel =
    donation.termNumber != null ? String(donation.termNumber) : id.slice(0, 8);
  const filename = safeFileName(
    `${labelHint.replace(/\s+/g, "-").slice(0, 40)}-${termLabel}-${(donation.donataria.name || "donataria").replace(/\s+/g, "-").slice(0, 40)}.pdf`,
  );

  const contentType =
    upstream.headers.get("content-type")?.includes("pdf") ||
    pdfUrl.toLowerCase().includes(".pdf")
      ? "application/pdf"
      : upstream.headers.get("content-type") || "application/octet-stream";

  return new Response(buf, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}
