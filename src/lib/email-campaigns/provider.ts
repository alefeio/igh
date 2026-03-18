/**
 * Resultado do envio de um e-mail pelo provider.
 */
export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string | null;
  providerResponse?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

/**
 * Parâmetros para envio de e-mail (compatível com Resend e outros).
 */
export interface EmailSendParams {
  to: string;
  subject: string;
  html?: string | null;
  text?: string | null;
}

/**
 * Interface desacoplada do provider de e-mail.
 * Implementações: Resend, mock, etc.
 */
export interface EmailProvider {
  readonly name: string;
  send(params: EmailSendParams): Promise<EmailSendResult>;
  isConfigured(): boolean;
}

/**
 * Provider mock que não envia e-mail (útil quando não está configurado).
 */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    return {
      success: true,
      providerMessageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      providerResponse: {
        mock: true,
        to: params.to,
        subjectLength: params.subject?.length ?? 0,
      },
    };
  }
}

import {
  isResendRateLimitError,
  sleep,
  throttleBeforeResendCall,
} from "@/lib/email/resend-rate-limit";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_RATE_LIMIT_RETRIES = 5;
const EMAIL_FROM = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME ?? "";

/**
 * Provider Resend (configuração via env: RESEND_API_KEY, EMAIL_FROM ou RESEND_FROM_EMAIL, RESEND_FROM_NAME opcional).
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  isConfigured(): boolean {
    return Boolean(RESEND_API_KEY && RESEND_API_KEY.trim().length > 0);
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorMessage:
          "Resend não configurado. Defina RESEND_API_KEY (e opcionalmente EMAIL_FROM/RESEND_FROM_EMAIL, RESEND_FROM_NAME) no .env",
      };
    }
    const from = RESEND_FROM_NAME
      ? `${RESEND_FROM_NAME} <${EMAIL_FROM}>`
      : EMAIL_FROM;
    const html =
      params.html != null && params.html.trim() !== ""
        ? params.html
        : (params.text ?? "").replace(/\n/g, "<br>\n");
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_API_KEY);
      let lastErrorMessage = "Resend error";
      for (let attempt = 0; attempt <= RESEND_RATE_LIMIT_RETRIES; attempt++) {
        await throttleBeforeResendCall();
        const { data, error } = await resend.emails.send({
          from,
          to: params.to,
          subject: params.subject,
          html,
          ...(params.text != null &&
            params.text.trim() !== "" && { text: params.text }),
        });
        if (!error) {
          return {
            success: true,
            providerMessageId: data?.id ?? undefined,
            providerResponse: data ? (data as unknown as Record<string, unknown>) : undefined,
          };
        }
        lastErrorMessage =
          typeof error === "string" ? error : (error as { message?: string }).message ?? "Resend error";
        if (isResendRateLimitError(lastErrorMessage) && attempt < RESEND_RATE_LIMIT_RETRIES) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        return {
          success: false,
          errorMessage: lastErrorMessage,
          providerResponse: (error as Record<string, unknown>) ?? undefined,
        };
      }
      return {
        success: false,
        errorMessage: lastErrorMessage,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorMessage: message,
        providerResponse: err instanceof Error ? { name: err.name } : undefined,
      };
    }
  }
}

let _provider: EmailProvider | null = null;

/**
 * Retorna o provider de e-mail configurado (env EMAIL_PROVIDER: resend | mock).
 * Se não configurado ou inválido, retorna MockEmailProvider.
 */
export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;
  const kind = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  if (kind === "resend") {
    const p = new ResendEmailProvider();
    _provider = p.isConfigured() ? p : new MockEmailProvider();
  } else {
    _provider = new MockEmailProvider();
  }
  return _provider;
}
