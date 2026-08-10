import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalMoneyCents = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Math.round(v * 100);
    const normalized = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    if (normalized === "") return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  });

export const upsertAnnualGoalSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  computersTarget: z.number().int().min(0).default(0),
  peopleTarget: z.number().int().min(0).default(0),
  notes: optionalText,
});

export const createPaymentAgreementSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updatePaymentAgreementSchema = createPaymentAgreementSchema.partial();

export const moveEmployeeAgreementSchema = z.object({
  paymentAgreementId: z.string().uuid().nullable(),
  monthlyPay: optionalMoneyCents,
});
