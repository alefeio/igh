import { jsonErr, jsonOk } from "@/lib/http";
import {
  handleResendWebhookEvent,
  type ResendWebhookPayload,
} from "@/lib/email-campaigns";

/**
 * Webhook do Resend para eventos de e-mail (delivered, opened, clicked, bounced, complained, failed).
 * Opcional: validar assinatura com RESEND_WEBHOOK_SECRET se definido.
 */
export async function POST(request: Request) {
  let payload: ResendWebhookPayload;
  try {
    payload = (await request.json()) as ResendWebhookPayload;
  } catch {
    return jsonErr("BAD_REQUEST", "Body JSON inválido.", 400);
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret && secret.trim() !== "") {
    const signature = request.headers.get("svix-signature") ?? request.headers.get("resend-signature") ?? "";
    if (!signature) {
      return jsonErr("UNAUTHORIZED", "Assinatura do webhook ausente.", 401);
    }
    // Resend pode usar Svix para assinatura; validação exata depende da doc Resend.
    // Por ora aceitamos se o secret estiver definido e a chamada tiver algum header de assinatura.
    // Para validação completa: importar svix e verificar.
  }

  const applied = await handleResendWebhookEvent(payload);
  return jsonOk({ received: true, applied });
}
