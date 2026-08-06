import "server-only";

import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";

/** Marcador nos templates; substituído em `sendEmail` pela logo de Site → Configurações. */
export const EMAIL_LOGO_SRC_PLACEHOLDER = "__CADASTRO_CURSOS_EMAIL_LOGO__";

const FALLBACK_LOGO_PATH = "/images/logo.png";

function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export type EmailSiteBranding = {
  logoUrl: string;
  /** Nome exibido na lista do Gmail / clientes de e-mail. */
  siteName: string;
};

/**
 * Logo + nome do site (Admin → Site → Configurações).
 * Fallback: logo estática e `BRAND.legalName`.
 */
export async function resolveEmailSiteBranding(): Promise<EmailSiteBranding> {
  let logoUrl = appUrl(FALLBACK_LOGO_PATH);
  let siteName = BRAND.legalName;
  try {
    const s = await prisma.siteSettings.findFirst({
      select: { logoUrl: true, siteName: true },
    });
    const rawLogo = s?.logoUrl?.trim();
    if (rawLogo) {
      logoUrl = /^https?:\/\//i.test(rawLogo)
        ? rawLogo
        : appUrl(rawLogo.startsWith("/") ? rawLogo : `/${rawLogo}`);
    }
    const rawName = s?.siteName?.trim();
    if (rawName) siteName = rawName;
  } catch {
    /* mantém fallbacks */
  }
  return { logoUrl, siteName };
}

/** Extrai só o endereço de `noreply@x` ou `Nome <noreply@x>`. */
export function extractEmailAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim();
  return from.trim();
}

/**
 * Formato RFC para o Gmail mostrar o nome da empresa: `"Nome do site" <noreply@dominio>`.
 */
export function formatEmailFrom(displayName: string, emailFromEnv: string): string {
  const addr = extractEmailAddress(emailFromEnv);
  const name = displayName.replace(/[\r\n"\\]/g, " ").trim();
  if (!name || !addr) return addr || emailFromEnv;
  return `"${name}" <${addr}>`;
}

export async function resolveEmailFrom(emailFromEnv: string): Promise<string> {
  const { siteName } = await resolveEmailSiteBranding();
  return formatEmailFrom(siteName, emailFromEnv);
}

/** @deprecated Prefer `resolveEmailSiteBranding` — mantido para usos pontuais. */
export async function resolveEmailLogoUrl(): Promise<string> {
  return (await resolveEmailSiteBranding()).logoUrl;
}

function applyLogoWithUrl(html: string, logoUrl: string): string {
  const fallbackAbs = appUrl(FALLBACK_LOGO_PATH);
  let out = html;
  if (out.includes(EMAIL_LOGO_SRC_PLACEHOLDER)) {
    out = out.split(EMAIL_LOGO_SRC_PLACEHOLDER).join(logoUrl);
  }
  if (out.includes(fallbackAbs)) {
    out = out.split(fallbackAbs).join(logoUrl);
  }
  out = out.replace(/(https?:\/\/[^"'>\s]+)\/images\/logo\.png/gi, logoUrl);
  out = out.replace(/(["'(=])\/images\/logo\.png/gi, `$1${logoUrl}`);
  return out;
}

/** Troca o placeholder (e a logo estática antiga) pela logo cadastrada. */
export async function applyEmailLogoToHtml(html: string): Promise<string> {
  const { logoUrl } = await resolveEmailSiteBranding();
  return applyLogoWithUrl(html, logoUrl);
}

/** Logo + From com nome do site — uma única leitura de SiteSettings. */
export async function prepareTransactionalEmail(params: {
  html: string;
  from: string;
}): Promise<{ html: string; from: string }> {
  const branding = await resolveEmailSiteBranding();
  return {
    html: applyLogoWithUrl(params.html, branding.logoUrl),
    from: formatEmailFrom(branding.siteName, params.from),
  };
}
