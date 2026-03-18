import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isResendRateLimitError,
  sleep,
  throttleBeforeResendCall,
} from "@/lib/email/resend-rate-limit";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

/**
 * URL base para links em campanhas ({link}, {link_area_aluno}).
 * 1) APP_URL no .env do servidor · 2) Admin → Site → Configurações → URL pública do site · 3) localhost.
 */
export async function resolvePublicAppUrl(): Promise<string> {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  try {
    const s = await prisma.siteSettings.findFirst({ select: { publicAppUrl: true } });
    const u = s?.publicAppUrl?.trim();
    if (u) return u.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return "http://localhost:3000";
}
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, from = EMAIL_FROM } = params;
  const toList = Array.isArray(to) ? to : [to];

  if (!RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[email] RESEND_API_KEY nao definida; email nao enviado.", { to: toList, subject });
    }
    return { success: false, error: "Configuracao de email indisponivel (RESEND_API_KEY)." };
  }

  const maxRetries = 5;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);
    let lastErr = "Erro ao enviar email.";
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await throttleBeforeResendCall();
      const { data, error } = await resend.emails.send({
        from,
        to: toList,
        subject,
        html,
      });
      if (!error) {
        return { success: true, messageId: data?.id };
      }
      lastErr = typeof error === "string" ? error : error.message;
      if (isResendRateLimitError(lastErr) && attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return { success: false, error: lastErr };
    }
    return { success: false, error: lastErr };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao enviar email.";
    return { success: false, error: message };
  }
}

export function getAppUrl(path: string): string {
  const base = APP_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
