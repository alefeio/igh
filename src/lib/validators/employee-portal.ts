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
  })
  .refine((v) => v == null || (v > 0 && v <= 100_000_000), "Valor inválido");

const httpsUrl = z
  .string()
  .url("URL inválida")
  .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS");

export const updateEmployeePortalProfileSchema = z.object({
  photoUrl: httpsUrl.nullable().optional(),
});

export const createInvoiceSubmissionSchema = z.object({
  referenceMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Competência inválida (use AAAA-MM)"),
  amount: optionalMoneyCents,
  description: optionalText,
  supplier: optionalText,
  invoiceNumber: optionalText,
  fileUrl: httpsUrl,
  filePublicId: optionalText,
  fileName: optionalText,
});

export const readInvoiceSchema = z.object({
  attachmentUrl: httpsUrl,
  attachmentFileName: optionalText,
});

export const createPortalThreadSchema = z.object({
  subject: z.string().trim().min(3, "Informe o assunto.").max(160),
  content: z.string().trim().min(3, "Escreva a mensagem.").max(8000),
});

export const replyPortalThreadSchema = z.object({
  content: z.string().trim().min(1, "Escreva a mensagem.").max(8000),
});

export const reviewInvoiceSubmissionSchema = z.object({
  action: z.enum(["APROVAR", "RECUSAR"]),
  reviewNotes: optionalText,
  createFinancialEntry: z.boolean().optional().default(true),
});
