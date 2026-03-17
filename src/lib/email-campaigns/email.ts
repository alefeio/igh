export interface EmailResult {
  original: string;
  normalized: string;
  valid: boolean;
  invalidReason?: string;
}

/** Regex básico para formato de e-mail (RFC simplificado). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normaliza e-mail: trim e lowercase para deduplicação.
 * Mantém original para auditoria.
 */
export function normalizeEmail(raw: string): { original: string; normalized: string } {
  const original = (raw ?? "").trim();
  const normalized = original.toLowerCase();
  return { original, normalized };
}

/**
 * Valida formato básico de e-mail.
 * Retorna resultado com original, normalizado e motivo de invalidade se houver.
 */
export function validateEmail(raw: string): EmailResult {
  const { original, normalized } = normalizeEmail(raw);
  if (!normalized) {
    return { original, normalized: "", valid: false, invalidReason: "empty" };
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return {
      original,
      normalized,
      valid: false,
      invalidReason: "invalid_format",
    };
  }
  if (normalized.length > 254) {
    return {
      original,
      normalized,
      valid: false,
      invalidReason: "too_long",
    };
  }
  return { original, normalized, valid: true };
}
