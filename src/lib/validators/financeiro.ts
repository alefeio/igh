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
const paymentStatusEnum = z.enum(["EM_ABERTO", "PAGO", "PENDENTE"]);

const listKinds = ["ENTRADA", "SAIDA"] as const;
const listPaymentStatuses = ["EM_ABERTO", "PAGO", "PENDENTE"] as const;
const listDueAlerts = ["soon", "today", "overdue", "attention"] as const;

const listExpenseNatures = ["FIXA", "VARIAVEL", "NONE"] as const;

type FinancialListKind = (typeof listKinds)[number];
type FinancialListPaymentStatus = (typeof listPaymentStatuses)[number];
type FinancialListDueAlert = (typeof listDueAlerts)[number];
type FinancialListExpenseNature = (typeof listExpenseNatures)[number];

function parseAllowed<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value != null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

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
    /** Data de vencimento. */
    entryDate: requiredDate,
    /**
     * Quando o vencimento já passou: true = Pago, false = Pendente.
     * Ignorado se o vencimento for hoje ou futuro (sempre Em aberto).
     */
    alreadyPaid: z.boolean().nullable().optional(),
    paymentStatus: paymentStatusEnum.optional(),
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
    expenseNature: z.enum(["FIXA", "VARIAVEL"]).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.responsibleUserId && !data.responsibleName) {
      ctx.addIssue({
        code: "custom",
        path: ["responsibleName"],
        message: "Informe o responsável (usuário ou nome).",
      });
    }
    if (data.kind === "ENTRADA" && data.expenseNature) {
      ctx.addIssue({
        code: "custom",
        path: ["expenseNature"],
        message: "Natureza da despesa só se aplica a saídas.",
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
    paymentStatus: paymentStatusEnum.optional(),
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
    expenseNature: z.enum(["FIXA", "VARIAVEL"]).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.responsibleUserId === null &&
      (data.responsibleName === null || data.responsibleName === undefined)
    ) {
      if ("responsibleUserId" in data && "responsibleName" in data) {
        ctx.addIssue({
          code: "custom",
          path: ["responsibleName"],
          message: "Informe o responsável (usuário ou nome).",
        });
      }
    }
    if (data.kind === "ENTRADA" && data.expenseNature) {
      ctx.addIssue({
        code: "custom",
        path: ["expenseNature"],
        message: "Natureza da despesa só se aplica a saídas.",
      });
    }
  });

/** Filtros de listagem / exportação. */
export type FinancialListQuery = {
  kind: FinancialListKind | undefined;
  categoryId: string | undefined;
  poloId: string | undefined;
  q: string | undefined;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  month: string | undefined;
  paymentStatus: FinancialListPaymentStatus | undefined;
  dueAlert: FinancialListDueAlert | undefined;
  expenseNature: FinancialListExpenseNature | undefined;
};

export function parseFinancialListQuery(searchParams: URLSearchParams): FinancialListQuery {
  const kind = searchParams.get("kind");
  const categoryId = searchParams.get("categoryId");
  const poloId = searchParams.get("poloId");
  const month = searchParams.get("month"); // YYYY-MM
  const q = searchParams.get("q")?.trim() || undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const paymentStatus = searchParams.get("paymentStatus");
  const dueAlert = searchParams.get("dueAlert"); // soon | today | overdue | attention
  const expenseNature = searchParams.get("expenseNature");

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    dateFrom = new Date(Date.UTC(y, m - 1, 1));
    dateTo = new Date(Date.UTC(y, m, 0));
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    dateFrom = new Date(`${from}T00:00:00.000Z`);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    dateTo = new Date(`${to}T00:00:00.000Z`);
  }

  return {
    kind: parseAllowed(kind, listKinds),
    categoryId: categoryId || undefined,
    poloId: poloId || undefined,
    q,
    dateFrom,
    dateTo,
    month: month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
    paymentStatus: parseAllowed(paymentStatus, listPaymentStatuses),
    dueAlert: parseAllowed(dueAlert, listDueAlerts),
    expenseNature: parseAllowed(expenseNature, listExpenseNatures),
  };
}

/** Mantém só dígitos se o cliente enviar CPF no fornecedor por engano — não usado hoje. */
export function normalizeOptionalDigits(value: string | null | undefined, max: number) {
  if (!value) return null;
  const d = normalizeDigits(value);
  return d ? d.slice(0, max) : null;
}
