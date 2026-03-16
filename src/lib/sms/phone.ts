import { normalizeDigits } from "@/lib/validators/students";

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 11;

export interface PhoneResult {
  original: string;
  normalized: string;
  valid: boolean;
  invalidReason?: string;
}

/**
 * Normaliza telefone para apenas dígitos (Brasil).
 * Mantém original para auditoria e retorna versão normalizada.
 */
export function normalizePhone(raw: string): { original: string; normalized: string } {
  const original = (raw ?? "").trim();
  const normalized = normalizeDigits(original);
  return { original, normalized };
}

/**
 * Valida telefone para uso em SMS (Brasil: mínimo 10, máximo 11 dígitos).
 * Retorna resultado com original, normalizado e motivo de invalidade se houver.
 */
export function validatePhone(raw: string): PhoneResult {
  const { original, normalized } = normalizePhone(raw);
  if (!normalized) {
    return { original, normalized: "", valid: false, invalidReason: "empty" };
  }
  if (normalized.length < MIN_PHONE_DIGITS) {
    return {
      original,
      normalized,
      valid: false,
      invalidReason: "too_short",
    };
  }
  if (normalized.length > MAX_PHONE_DIGITS) {
    return {
      original,
      normalized,
      valid: false,
      invalidReason: "too_long",
    };
  }
  return { original, normalized, valid: true };
}
