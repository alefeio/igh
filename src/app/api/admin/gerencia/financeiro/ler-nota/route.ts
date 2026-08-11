import { z } from "zod";

import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { matchCategoryName } from "@/lib/financeiro-invoice-parse";
import { readInvoiceAttachment } from "@/lib/financeiro-invoice-read";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  attachmentUrl: z
    .string()
    .url("URL inválida")
    .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS"),
  attachmentFileName: z.string().trim().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const result = await readInvoiceAttachment({
      attachmentUrl: parsed.data.attachmentUrl,
      attachmentFileName: parsed.data.attachmentFileName,
    });

    let categoryId: string | undefined;
    const categoryName = result.suggestion.categoryName?.trim();
    if (categoryName) {
      const existing = await prisma.financialCategory.findMany({
        where: { kind: "SAIDA", isActive: true },
        select: { id: true, name: true },
      });
      const matched = matchCategoryName(existing, categoryName);
      if (matched) {
        categoryId = matched.id;
        result.suggestion.categoryName = matched.name;
      }
    }

    return jsonOk({ ...result, categoryId: categoryId ?? null });
  } catch (e) {
    console.error("[financeiro/ler-nota]", e);
    return jsonErr("READ_FAILED", "Falha ao ler a nota. Preencha o formulário manualmente.", 500);
  }
}
