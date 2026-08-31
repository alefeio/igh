import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

function safeFileName(name: string): string {
  return name.replace(/[\r\n"]/g, "").trim().slice(0, 180) || "contrato.pdf";
}

/** Proxy do PDF do contrato: inline (visualizar) ou attachment (download=1). */
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
  const variant = searchParams.get("variant");

  const contract = await prisma.employeeContract.findFirst({
    where: { id, deletedAt: null },
    select: {
      pdfUrl: true,
      signedPdfUrl: true,
      kind: true,
      employee: { select: { name: true } },
    },
  });
  if (!contract) {
    return jsonErr("NOT_FOUND", "Contrato não encontrado.", 404);
  }

  const pdfUrl = variant === "signed" ? contract.signedPdfUrl : contract.pdfUrl;
  if (!pdfUrl) {
    return jsonErr("NOT_FOUND", "PDF do contrato não encontrado.", 404);
  }

  const upstream = await fetch(pdfUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return jsonErr("FETCH_FAILED", "Não foi possível obter o PDF do contrato.", 502);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const filename = safeFileName(
    `${contract.kind.toLowerCase()}-${contract.employee.name.replace(/\s+/g, "-").slice(0, 40)}.pdf`,
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
