import { z } from "zod";

const smsAudienceTypeEnum = z.enum([
  "ALL_STUDENTS",
  "CLASS_GROUP",
  "STUDENTS_INCOMPLETE",
  "STUDENTS_COMPLETE",
  "STUDENTS_ACTIVE",
  "STUDENTS_INACTIVE",
  "BY_COURSE",
  "TEACHERS",
  "ADMINS",
  "ALL_ACTIVE_USERS",
]);

export const smsAudienceFiltersSchema = z
  .object({
    classGroupId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
  })
  .passthrough()
  .optional()
  .nullable();

export const createSmsCampaignSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(500).optional().nullable(),
  audienceType: smsAudienceTypeEnum,
  audienceFilters: smsAudienceFiltersSchema,
  templateId: z.string().uuid().optional().nullable(),
  messageContent: z.string().max(1600).optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
});

export const updateSmsCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  audienceType: smsAudienceTypeEnum.optional(),
  audienceFilters: smsAudienceFiltersSchema,
  templateId: z.string().uuid().optional().nullable(),
  messageContent: z.string().max(1600).optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
});

export const confirmSmsCampaignSchema = z.object({
  messageContent: z.string().min(1, "Mensagem é obrigatória").max(1600),
  sendImmediately: z.boolean().optional().default(false),
});

export const listSmsCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z
    .enum(["DRAFT", "SCHEDULED", "PROCESSING", "SENT", "PARTIALLY_SENT", "FAILED", "CANCELED"])
    .optional(),
  search: z.string().optional(),
});

export const previewSmsCampaignBodySchema = z.object({
  audienceType: smsAudienceTypeEnum,
  audienceFilters: smsAudienceFiltersSchema,
});

export const createSmsTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(500).optional().nullable(),
  categoryHint: z.string().max(100).optional().nullable(),
  content: z.string().min(1, "Conteúdo é obrigatório").max(1600),
  active: z.boolean().optional().default(true),
});

export const updateSmsTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  categoryHint: z.string().max(100).optional().nullable(),
  content: z.string().min(1).max(1600).optional(),
  active: z.boolean().optional(),
});
