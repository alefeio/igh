import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
  .transform((v) => (v == null ? null : new Date(`${v}T00:00:00.000Z`)));

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
  .refine((v) => v == null || (v >= 0 && v <= 100_000_000), "Valor fora do intervalo permitido");

export const documentTemplateTypeEnum = z.enum(["CONTRATO", "DISTRATO", "TERMO_DOACAO"]);
export const employeeContractKindEnum = z.enum(["CONTRATO", "DISTRATO"]);
export const employeeContractStatusEnum = z.enum(["RASCUNHO", "ATIVO", "ENCERRADO", "CANCELADO"]);
export const monthlyInvoiceStatusEnum = z.enum(["PENDENTE", "ENTREGUE", "ATRASADA"]);

export const createDocumentTemplateSchema = z.object({
  type: documentTemplateTypeEnum,
  title: z.string().trim().min(3, "Título é obrigatório"),
  contentRich: z.string().min(1, "Conteúdo do modelo é obrigatório"),
  isActive: z.boolean().optional().default(true),
});

export const updateDocumentTemplateSchema = createDocumentTemplateSchema.partial();

export const createEmployeeContractSchema = z
  .object({
    employeeId: z.string().uuid("Colaborador inválido"),
    templateId: z.string().uuid("Modelo inválido"),
    kind: employeeContractKindEnum.default("CONTRATO"),
    parentContractId: z.string().uuid().nullable().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida")
      .transform((v) => new Date(`${v}T00:00:00.000Z`)),
    endDate: optionalDate,
    monthlyValue: optionalMoneyCents,
    description: optionalText,
    status: employeeContractStatusEnum.optional().default("ATIVO"),
    generatePdf: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "DISTRATO" && !data.parentContractId) {
      ctx.addIssue({
        code: "custom",
        path: ["parentContractId"],
        message: "Informe o contrato original do distrato.",
      });
    }
  });

export const updateEmployeeContractSchema = z.object({
  status: employeeContractStatusEnum.optional(),
  endDate: optionalDate,
  description: optionalText,
  signedPdfUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS")
    .nullable()
    .optional(),
  signedPdfPublicId: optionalText,
});

export const createMonthlyInvoiceSchema = z.object({
  employeeId: z.string().uuid("Colaborador inválido"),
  /** YYYY-MM */
  referenceMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Competência inválida")
    .transform((v) => {
      const [y, m] = v.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, 1));
    }),
  amount: optionalMoneyCents,
  status: monthlyInvoiceStatusEnum.optional().default("ENTREGUE"),
  notes: optionalText,
  pdfUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS")
    .nullable()
    .optional(),
  pdfPublicId: optionalText,
  issuedAt: optionalDate,
});

export const updateMonthlyInvoiceSchema = z.object({
  amount: optionalMoneyCents,
  status: monthlyInvoiceStatusEnum.optional(),
  notes: optionalText,
  pdfUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS")
    .nullable()
    .optional(),
  pdfPublicId: optionalText,
  issuedAt: optionalDate,
});
