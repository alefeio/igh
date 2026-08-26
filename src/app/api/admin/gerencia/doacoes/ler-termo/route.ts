import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManagerWrite } from "@/lib/auth";
import { readDonationTermAttachment } from "@/lib/donation-term-read";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readDonationTermSchema } from "@/lib/validators/inventory-donations";

/** Lê PDF/imagem de termo assinado e sugere campos do formulário. */
export async function POST(request: Request) {
  try {
    await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = readDonationTermSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const [donors, donatarias] = await Promise.all([
      prisma.donorInstitutionSettings.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, document: true },
      }),
      prisma.donataria.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, document: true },
      }),
    ]);

    const result = await readDonationTermAttachment({
      attachmentUrl: parsed.data.attachmentUrl,
      attachmentFileName: parsed.data.attachmentFileName,
      donors,
      donatarias,
    });

    return jsonOk(result);
  } catch (e) {
    console.error("[doacoes/ler-termo]", e);
    return jsonErr(
      "READ_FAILED",
      "Falha ao ler o termo. Preencha o formulário manualmente.",
      500,
    );
  }
}
