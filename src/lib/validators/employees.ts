import { z } from "zod";

import { normalizeDigits } from "@/lib/validators/students";

const positionEnum = z.enum([
  "DIRETOR",
  "GERENTE",
  "COORDENADOR_POLO",
  "PROFESSOR",
  "VIGIA",
  "LIMPEZA",
  "MOTORISTA",
  "ADMINISTRATIVO",
  "OPERACIONAL",
]);
const employmentTypeEnum = z.enum(["MEI", "CLT", "PRESTADOR", "VOLUNTARIO", "ESTAGIO"]);
const statusEnum = z.enum(["ATIVO", "AFASTADO", "DESLIGADO"]);
const uniformSizeEnum = z.enum(["PP", "P", "M", "G", "GG", "XG", "XGG"]);
const bankAccountTypeEnum = z.enum(["CORRENTE", "POUPANCA", "PAGAMENTO"]);
const pixKeyTypeEnum = z.enum(["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"]);

export const employeeDocumentTypeEnum = z.enum([
  "RG",
  "CPF",
  "CNPJ_MEI",
  "COMPROVANTE_RESIDENCIA",
  "DADOS_BANCARIOS",
  "CONTRATO",
  "DISTRATO",
  "NOTA_MENSAL",
  "OUTRO",
]);

/** Campo de texto livre: string vazia vira null para não poluir o banco. */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalDigits = (max: number, label: string) =>
  z
    .string()
    .transform((v) => {
      const digits = normalizeDigits(v);
      return digits === "" ? null : digits;
    })
    .refine((v) => v === null || v.length <= max, `${label} deve ter no máximo ${max} dígitos`)
    .nullable()
    .optional();

/** "YYYY-MM-DD" → Date em UTC; vazio → null. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
  .transform((v) => (v == null ? null : new Date(`${v}T00:00:00.000Z`)));

const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v.toLowerCase()))
  .nullable()
  .optional()
  .refine((v) => v == null || z.string().email().safeParse(v).success, "E-mail inválido");

/** Valor em reais ("1.234,56" ou "1234.56") → centavos. */
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

const employeeBaseSchema = z.object({
  userId: z.string().uuid("Usuário inválido").nullable().optional(),
  name: z.string().trim().min(3, "Nome é obrigatório"),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .transform((v) => normalizeDigits(v))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  rg: optionalText,
  rgIssuer: optionalText,
  birthDate: optionalDate,
  email: optionalEmail,
  phone: optionalDigits(11, "Telefone"),
  position: positionEnum,
  positionLabel: optionalText,
  employmentType: employmentTypeEnum.default("MEI"),
  status: statusEnum.default("ATIVO"),
  admissionDate: optionalDate,
  terminationDate: optionalDate,
  monthlyPay: optionalMoneyCents,
  uniformSize: uniformSizeEnum.nullable().optional(),
  shoeSize: optionalText,
  meiCnpj: optionalDigits(14, "CNPJ"),
  meiCompanyName: optionalText,
  bankName: optionalText,
  bankAgency: optionalText,
  bankAccount: optionalText,
  bankAccountType: bankAccountTypeEnum.nullable().optional(),
  pixKeyType: pixKeyTypeEnum.nullable().optional(),
  pixKey: optionalText,
  cep: optionalDigits(8, "CEP"),
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: optionalText,
  notes: optionalText,
  poloId: z.string().uuid("Polo inválido").nullable().optional(),
});

/** Desligamento sem data deixa a ficha ambígua no histórico e nos relatórios. */
function requireTerminationDateWhenDismissed(
  data: { status?: string; terminationDate?: Date | null },
  ctx: z.RefinementCtx,
) {
  if (data.status === "DESLIGADO" && !data.terminationDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["terminationDate"],
      message: "Informe a data de desligamento.",
    });
  }
}

export const createEmployeeSchema = employeeBaseSchema.superRefine(
  requireTerminationDateWhenDismissed,
);

export const updateEmployeeSchema = employeeBaseSchema
  .partial()
  .superRefine(requireTerminationDateWhenDismissed);

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const createEmployeeDocumentSchema = z
  .object({
    type: employeeDocumentTypeEnum,
    title: optionalText,
    /** Competência da nota mensal no formato "YYYY-MM". */
    referenceMonth: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional()
      .refine((v) => v == null || /^\d{4}-\d{2}$/.test(v), "Competência inválida (use MM/AAAA)"),
    amount: optionalMoneyCents,
    publicId: z.string().min(1, "publicId é obrigatório"),
    url: z
      .string()
      .url("URL inválida")
      .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS"),
    fileName: optionalText,
    mimeType: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => !v || ALLOWED_DOCUMENT_MIME.includes(v as (typeof ALLOWED_DOCUMENT_MIME)[number]),
        "Tipo de arquivo não permitido (PDF, JPG, PNG ou WEBP)",
      ),
    sizeBytes: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .refine(
        (v) => v == null || v <= MAX_DOCUMENT_SIZE_BYTES,
        `Tamanho máximo: ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024}MB`,
      ),
  })
  .superRefine((data, ctx) => {
    if (data.type === "NOTA_MENSAL" && !data.referenceMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceMonth"],
        message: "Informe a competência (mês/ano) da nota.",
      });
    }
  });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateEmployeeDocumentInput = z.infer<typeof createEmployeeDocumentSchema>;

export const ALLOWED_EMPLOYEE_DOCUMENT_MIME = ALLOWED_DOCUMENT_MIME;
export const MAX_EMPLOYEE_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_BYTES;
