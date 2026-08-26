import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
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
  const download = new URL(request.url).searchParams.get("download") === "1";

  const donation = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    select: {
      pdfUrl: true,
      termNumber: true,
      donataria: { select: { name: true } },
    },
  });
  if (!donation?.pdfUrl) {
    return jsonErr("NOT_FOUND", "PDF do termo não encontrado.", 404);
  }

  const upstream = await fetch(donation.pdfUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return jsonErr("FETCH_FAILED", "Não foi possível obter o PDF do termo.", 502);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const termLabel =
    donation.termNumber != null ? String(donation.termNumber) : id.slice(0, 8);
  const filename = safeFileName(
    `termo-doacao-${termLabel}-${(donation.donataria.name || "donataria").replace(/\s+/g, "-").slice(0, 40)}.pdf`,
  );

  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}
