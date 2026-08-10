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

export const openPayrollMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Informe o mês (AAAA-MM)"),
  responsibleName: optionalText,
  notes: optionalText,
});

export const updatePayrollMonthSchema = z.object({
  status: z.enum(["ABERTA", "FECHADA"]).optional(),
  responsibleName: optionalText,
  notes: optionalText,
});

export const updatePayrollLineSchema = z.object({
  amountCents: optionalMoneyCents,
  amount: optionalMoneyCents,
  offBooksPayCents: optionalMoneyCents,
  offBooksPay: optionalMoneyCents,
  observation: optionalText,
  fundingChannel: z.enum(["CONVENIO", "POR_FORA"]).optional(),
  fundingContractRef: optionalText,
  paymentStatus: z.enum(["PENDENTE", "PAGO"]).optional(),
});

export const updateMealTicketLineSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  notes: optionalText,
});
