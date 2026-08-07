import { z } from "zod";

import { normalizeDigits } from "@/lib/validators/students";

const kindEnum = z.enum(["ENTRADA", "SAIDA"]);
const paymentMethodEnum = z.enum([
  "PIX",
  "DINHEIRO",
  "TRANSFERENCIA",
  "BOLETO",
  "CARTAO",
  "CHEQUE",
  "OUTRO",
]);

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const requiredDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

/** Aceita reais ("1.234,56") ou número e grava em centavos. */
const moneyCents = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (typeof v === "number") return Math.round(v * 100);
    const normalized = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
  })
  .refine((v) => Number.isFinite(v) && v > 0 && v <= 100_000_000, "Informe um valor válido");

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

const optionalHttps = z
  .string()
  .url("URL inválida")
  .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS")
  .nullable()
  .optional();

export const createFinancialCategorySchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  kind: kindEnum,
  isActive: z.boolean().optional().default(true),
});

export const updateFinancialCategorySchema = createFinancialCategorySchema.partial();

export const createFinancialEntrySchema = z
  .object({
    kind: kindEnum,
    description: z.string().trim().min(3, "Descrição é obrigatória"),
    amount: moneyCents,
    entryDate: requiredDate,
    categoryId: z.string().uuid().nullable().optional(),
    paymentMethod: paymentMethodEnum.optional().default("PIX"),
    poloId: z.string().uuid().nullable().optional(),
    responsibleUserId: z.string().uuid().nullable().optional(),
    responsibleName: optionalText,
    invoiceNumber: optionalText,
    supplier: optionalText,
    notes: optionalText,
    attachmentUrl: optionalHttps,
    attachmentPublicId: optionalText,
    attachmentFileName: optionalText,
  })
  .superRefine((data, ctx) => {
    if (!data.responsibleUserId && !data.responsibleName) {
      ctx.addIssue({
        code: "custom",
        path: ["responsibleName"],
        message: "Informe o responsável (usuário ou nome).",
      });
    }
  });

export const updateFinancialEntrySchema = z
  .object({
    kind: kindEnum.optional(),
    description: z.string().trim().min(3).optional(),
    amount: optionalMoneyCents,
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .transform((v) => new Date(`${v}T00:00:00.000Z`))
      .optional(),
    categoryId: z.string().uuid().nullable().optional(),
    paymentMethod: paymentMethodEnum.optional(),
    poloId: z.string().uuid().nullable().optional(),
    responsibleUserId: z.string().uuid().nullable().optional(),
    responsibleName: optionalText,
    invoiceNumber: optionalText,
    supplier: optionalText,
    notes: optionalText,
    attachmentUrl: optionalHttps,
    attachmentPublicId: optionalText,
    attachmentFileName: optionalText,
  })
  .superRefine((data, ctx) => {
    if (
      data.responsibleUserId === null &&
      (data.responsibleName === null || data.responsibleName === undefined)
    ) {
      // só valida quando os dois campos vieram no patch esvaziando o responsável
      if ("responsibleUserId" in data && "responsibleName" in data) {
        ctx.addIssue({
          code: "custom",
          path: ["responsibleName"],
          message: "Informe o responsável (usuário ou nome).",
        });
      }
    }
  });

/** Filtros de listagem / exportação. */
export function parseFinancialListQuery(searchParams: URLSearchParams) {
  const kind = searchParams.get("kind");
  const categoryId = searchParams.get("categoryId");
  const poloId = searchParams.get("poloId");
  const month = searchParams.get("month"); // YYYY-MM
  const q = searchParams.get("q")?.trim() || undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    dateFrom = new Date(Date.UTC(y, m - 1, 1));
    dateTo = new Date(Date.UTC(y, m, 0)); // último dia do mês
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    dateFrom = new Date(`${from}T00:00:00.000Z`);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    dateTo = new Date(`${to}T00:00:00.000Z`);
  }

  return {
    kind: kind === "ENTRADA" || kind === "SAIDA" ? kind : undefined,
    categoryId: categoryId || undefined,
    poloId: poloId || undefined,
    q,
    dateFrom,
    dateTo,
    month: month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
  };
}

export type FinancialListQuery = ReturnType<typeof parseFinancialListQuery>;

/** Mantém só dígitos se o cliente enviar CPF no fornecedor por engano — não usado hoje. */
export function normalizeOptionalDigits(value: string | null | undefined, max: number) {
  if (!value) return null;
  const d = normalizeDigits(value);
  return d ? d.slice(0, max) : null;
}
