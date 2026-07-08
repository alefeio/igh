type TurnstileSiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
};

export function isTurnstileConfigured(): boolean {
  return !!(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

export function getTurnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

/**
 * Valida token Cloudflare Turnstile.
 * Se as chaves não estiverem configuradas, retorna ok (fallback: honeypot + rate limit).
 */
export async function verifyTurnstileToken(params: {
  token: string | null | undefined;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true };
  }

  const token = params.token?.trim();
  if (!token) {
    return { ok: false, message: "Confirme que você não é um robô e tente novamente." };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (params.ip) body.set("remoteip", params.ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as TurnstileSiteverifyResponse;
    if (!data.success) {
      return { ok: false, message: "Verificação anti-robô falhou. Atualize a página e tente novamente." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível validar a verificação anti-robô. Tente novamente." };
  }
}

/** Campos honeypot típicos preenchidos por bots. */
export function isHoneypotFilled(body: Record<string, unknown> | null): boolean {
  if (!body) return false;
  const keys = ["website", "company", "url", "homepage"];
  for (const key of keys) {
    const v = body[key];
    if (typeof v === "string" && v.trim().length > 0) return true;
  }
  return false;
}

export function clientIpFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
