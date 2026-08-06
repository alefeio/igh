import "server-only";

import { prisma } from "@/lib/prisma";

/** Marcador nos templates; substituído em `sendEmail` pela logo de Site → Configurações. */
export const EMAIL_LOGO_SRC_PLACEHOLDER = "__CADASTRO_CURSOS_EMAIL_LOGO__";

const FALLBACK_LOGO_PATH = "/images/logo.png";

function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Logo para cabeçalho dos e-mails transacionais.
 * Usa `SiteSettings.logoUrl` (Admin → Site → Configurações); senão a logo estática do app.
 */
export async function resolveEmailLogoUrl(): Promise<string> {
  try {
    const s = await prisma.siteSettings.findFirst({ select: { logoUrl: true } });
    const raw = s?.logoUrl?.trim();
    if (raw) {
      if (/^https?:\/\//i.test(raw)) return raw;
      return appUrl(raw.startsWith("/") ? raw : `/${raw}`);
    }
  } catch {
    /* fallback abaixo */
  }
  return appUrl(FALLBACK_LOGO_PATH);
}

/** Troca o placeholder (e a logo estática antiga) pela logo cadastrada. */
export async function applyEmailLogoToHtml(html: string): Promise<string> {
  const logoUrl = await resolveEmailLogoUrl();
  const fallbackAbs = appUrl(FALLBACK_LOGO_PATH);
  let out = html;
  if (out.includes(EMAIL_LOGO_SRC_PLACEHOLDER)) {
    out = out.split(EMAIL_LOGO_SRC_PLACEHOLDER).join(logoUrl);
  }
  if (out.includes(fallbackAbs)) {
    out = out.split(fallbackAbs).join(logoUrl);
  }
  // Filas/outbox antigas ou HTML com APP_URL diferente.
  out = out.replace(/(https?:\/\/[^"'>\s]+)\/images\/logo\.png/gi, logoUrl);
  out = out.replace(/(["'(=])\/images\/logo\.png/gi, `$1${logoUrl}`);
  return out;
}
