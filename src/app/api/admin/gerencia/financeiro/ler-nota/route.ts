import { z } from "zod";

import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { readInvoiceAttachment } from "@/lib/financeiro-invoice-read";
import { jsonErr, jsonOk } from "@/lib/http";

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
    return jsonOk(result);
  } catch (e) {
    console.error("[financeiro/ler-nota]", e);
    return jsonErr("READ_FAILED", "Falha ao ler a nota. Preencha o formulário manualmente.", 500);
  }
}
