import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireEmployeePortal } from "@/lib/employee-portal";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

function guessContentType(fileName: string | null, fallback: string | null): string {
  const n = (fileName || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (fallback && fallback !== "application/octet-stream") return fallback;
  return "application/octet-stream";
}

function safeFileName(name: string | null): string {
  const raw = (name || "nota").replace(/[\r\n"]/g, "").trim() || "nota";
  return raw.slice(0, 180);
}

/** Proxy do arquivo da nota: inline (visualizar) ou attachment (?download=1). */
export async function GET(request: Request, ctx: Ctx) {
  let portal;
  try {
    portal = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const download = new URL(request.url).searchParams.get("download") === "1";

  const row = await prisma.employeeInvoiceSubmission.findFirst({
    where: { id, employeeId: portal.employee.id },
    select: { fileUrl: true, fileName: true },
  });
  if (!row?.fileUrl) {
    return jsonErr("NOT_FOUND", "Arquivo não encontrado.", 404);
  }

  const upstream = await fetch(row.fileUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return jsonErr("FETCH_FAILED", "Não foi possível obter o arquivo.", 502);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const type = guessContentType(row.fileName, upstream.headers.get("content-type"));
  const filename = safeFileName(row.fileName);

  return new Response(buf, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}
