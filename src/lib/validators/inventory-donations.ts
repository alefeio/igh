import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalHttps = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), "URL deve ser HTTPS")
  .nullable()
  .optional();

const requiredDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

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
  .refine((v) => v == null || (v >= 0 && v <= 100_000_000), "Valor inválido");

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  code: optionalText,
  category: optionalText,
  unit: z.string().trim().min(1).default("UN"),
  minStock: z.number().int().min(0).optional().default(0),
  location: optionalText,
  photoUrl: optionalHttps,
  photoPublicId: optionalText,
  notes: optionalText,
  isActive: z.boolean().optional().default(true),
  /** Saldo inicial opcional (gera movimento de entrada). */
  initialQuantity: z.number().int().min(0).optional().default(0),
});

export const updateInventoryItemSchema = createInventoryItemSchema
  .omit({ initialQuantity: true })
  .partial();

export const createInventoryMovementSchema = z.object({
  itemId: z.string().uuid(),
  type: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
  quantity: z.number().int().positive("Quantidade deve ser positiva"),
  reason: optionalText,
  responsibleUserId: z.string().uuid().nullable().optional(),
  responsibleName: optionalText,
  notes: optionalText,
});

export const createDonatariaSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  document: optionalText,
  email: optionalText,
  phone: optionalText,
  contactName: optionalText,
  cep: optionalText,
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: optionalText,
  notes: optionalText,
  isActive: z.boolean().optional().default(true),
});

export const updateDonatariaSchema = createDonatariaSchema.partial();

const donationItemSchema = z.object({
  inventoryItemId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "Nome do item é obrigatório"),
  quantity: z.number().int().positive(),
  unit: z.string().trim().min(1).default("UN"),
});

export const createDonationSchema = z
  .object({
    donatariaId: z.string().uuid("Donatária inválida"),
    kind: z.enum(["BENS", "DINHEIRO", "MISTO"]),
    donatedAt: requiredDate,
    description: optionalText,
    amount: optionalMoneyCents,
    templateId: z.string().uuid().nullable().optional(),
    generatePdf: z.boolean().optional().default(true),
    confirmNow: z.boolean().optional().default(false),
    postInventory: z.boolean().optional().default(true),
    postFinancial: z.boolean().optional().default(true),
    items: z.array(donationItemSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if ((data.kind === "BENS" || data.kind === "MISTO") && data.items.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Informe ao menos um item para doação de bens.",
      });
    }
    if ((data.kind === "DINHEIRO" || data.kind === "MISTO") && (data.amount == null || data.amount <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Informe o valor da doação em dinheiro.",
      });
    }
  });

export const confirmDonationSchema = z.object({
  postInventory: z.boolean().optional().default(true),
  postFinancial: z.boolean().optional().default(true),
  templateId: z.string().uuid().nullable().optional(),
  generatePdf: z.boolean().optional().default(true),
});
