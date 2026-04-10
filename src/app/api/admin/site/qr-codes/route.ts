import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const createBodySchema = z.object({
  title: z.string().optional().nullable(),
  link: z.string().min(1, "Informe o link."),
  centerImageUrl: z.string().optional().nullable(),
  imageUrl: z.string().url("URL da imagem inválida."),
});

/** Lista QR Codes gerados (admin). */
export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  try {
    const items = await prisma.siteQrCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        link: true,
        centerImageUrl: true,
        imageUrl: true,
        createdAt: true,
      },
    });
    return jsonOk({ items });
  } catch (e) {
    return jsonErr("SERVER_ERROR", "Erro ao listar QR Codes.", 500);
  }
}

/** Registra um QR gerado (após upload do PNG no cliente). */
export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  try {
    const body = await request.json().catch(() => null);
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }
    const title = (parsed.data.title ?? "").trim() || null;
    const link = parsed.data.link.trim();
    const centerImageUrl = (parsed.data.centerImageUrl ?? "").trim() || null;
    const imageUrl = parsed.data.imageUrl.trim();

    const row = await prisma.siteQrCode.create({
      data: {
        title,
        link,
        centerImageUrl,
        imageUrl,
        createdByUserId: user.id,
      },
      select: {
        id: true,
        title: true,
        link: true,
        centerImageUrl: true,
        imageUrl: true,
        createdAt: true,
      },
    });
    return jsonOk({ item: row });
  } catch (e) {
    return jsonErr("SERVER_ERROR", "Erro ao salvar QR Code.", 500);
  }
}
