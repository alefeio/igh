import { z } from "zod";

/**
 * YYYY-MM-DD opcional.
 * - campo omitido → undefined (não altera)
 * - "" → null (limpa)
 */
export const optionalBirthDateSchema = z
  .union([
    z.null(),
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida."),
  ])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return v;
  });

/**
 * Telefone/WhatsApp em dígitos.
 * - omitido → undefined
 * - "" → null
 */
export const optionalPhoneDigitsSchema = z
  .union([z.null(), z.string().trim().max(40)])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const digits = v.replace(/\D/g, "").slice(0, 13);
    return digits.length > 0 ? digits : null;
  });

export function birthDateInputToDate(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function birthDateToInputValue(value: Date | string | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const part = value.trim().split("T")[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : "";
  }
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
