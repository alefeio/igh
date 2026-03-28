import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getPublishedLegalBundle } from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  termsVersionId: z.string().uuid().nullable().optional(),
  privacyVersionId: z.string().uuid().nullable().optional(),
});

/**
 * Aceite de **Termos** e **Política de privacidade** para utilizadores com sessão (painel).
 * Cookies em rotas públicas são tratados à parte (`CookieConsentBanner` + localStorage).
 */
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const bundle = await getPublishedLegalBundle();
  const termsVersionId = parsed.data.termsVersionId ?? null;
  const privacyVersionId = parsed.data.privacyVersionId ?? null;

  if (bundle.terms) {
    if (termsVersionId !== bundle.terms.id) {
      return jsonErr("VALIDATION_ERROR", "Versão dos Termos de Uso não corresponde à publicada.", 400);
    }
  } else if (termsVersionId != null) {
    return jsonErr("VALIDATION_ERROR", "Não há termos publicados; não envie termsVersionId.", 400);
  }

  if (bundle.privacy) {
    if (privacyVersionId !== bundle.privacy.id) {
      return jsonErr("VALIDATION_ERROR", "Versão da Política de Privacidade não corresponde à publicada.", 400);
    }
  } else if (privacyVersionId != null) {
    return jsonErr("VALIDATION_ERROR", "Não há política de privacidade publicada; não envie privacyVersionId.", 400);
  }

  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Aceite de termos no painel requer sessão.", 401);
  }

  await prisma.userLegalAcceptance.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      termsVersionId: bundle.terms ? termsVersionId : null,
      privacyVersionId: bundle.privacy ? privacyVersionId : null,
      cookieVersionId: null,
    },
    update: {
      termsVersionId: bundle.terms ? termsVersionId : null,
      privacyVersionId: bundle.privacy ? privacyVersionId : null,
    },
  });

  return jsonOk({ saved: true });
}
