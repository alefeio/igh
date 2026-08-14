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
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido"),
  phone: optionalText,
  cep: optionalText,
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: optionalText,
  bankName: optionalText,
  bankAgency: optionalText,
  bankAccount: optionalText,
  bankAccountType: z.enum(["CORRENTE", "POUPANCA", "PAGAMENTO"]).nullable().optional(),
  pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"]).nullable().optional(),
  pixKey: optionalText,
  meiCnpj: optionalText,
  meiCompanyName: optionalText,
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
  acknowledgeBankMismatch: z.boolean().optional(),
});

export const adminCreateInvoiceSubmissionSchema = createInvoiceSubmissionSchema.extend({
  employeeId: z.string().uuid("Colaborador inválido"),
  /** Quando true, registra e já aprova (gerência anexou a NF recebida). */
  autoApprove: z.boolean().optional().default(false),
  createFinancialEntry: z.boolean().optional().default(true),
  reviewNotes: optionalText,
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

const cleaningLineSchema = z.object({
  inventoryItemId: z.string().uuid().nullable().optional(),
  itemName: z.string().trim().min(1, "Informe o nome do item.").max(200),
  kind: z.enum(["DISPONIVEL", "FALTANDO"]),
  quantity: z.coerce.number().int().positive("Quantidade deve ser positiva.").max(1_000_000),
  notes: optionalText,
});

export const createCleaningReportSchema = z.object({
  notes: optionalText,
  lines: z.array(cleaningLineSchema).min(1, "Inclua ao menos um item."),
});

export const createDriverLogSchema = z.object({
  kind: z.enum(["QUILOMETRAGEM", "NOTA_SERVICO", "OCORRENCIA"]),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)"),
  odometerKm: z
    .preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().int().nonnegative().nullable(),
    )
    .optional(),
  description: z.string().trim().min(1, "Descreva o registro.").max(8000),
  amount: optionalMoneyCents,
  supplier: optionalText,
  invoiceNumber: optionalText,
  fileUrl: httpsUrl.nullable().optional(),
  filePublicId: optionalText,
  fileName: optionalText,
});

export const reviewPortalItemSchema = z.object({
  reviewNotes: optionalText,
  createFinancialEntry: z.boolean().optional().default(false),
});
