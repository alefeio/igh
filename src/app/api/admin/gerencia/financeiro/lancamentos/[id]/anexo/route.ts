import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
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
  const raw = (name || "anexo").replace(/[\r\n"]/g, "").trim() || "anexo";
  return raw.slice(0, 180);
}

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

  const entry = await prisma.financialEntry.findFirst({
    where: { id, deletedAt: null },
    select: { attachmentUrl: true, attachmentFileName: true },
  });
  if (!entry?.attachmentUrl) {
    return jsonErr("NOT_FOUND", "Anexo não encontrado.", 404);
  }

  const upstream = await fetch(entry.attachmentUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return jsonErr("FETCH_FAILED", "Não foi possível obter o anexo.", 502);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const type = guessContentType(entry.attachmentFileName, upstream.headers.get("content-type"));
  const filename = safeFileName(entry.attachmentFileName);

  return new Response(buf, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}
