import { z } from "zod";

const emailAudienceTypeEnum = z.enum([
  "ALL_STUDENTS",
  "ENROLLED_STUDENTS",
  "CLASS_GROUP",
  "STUDENTS_INCOMPLETE",
  "STUDENTS_COMPLETE",
  "STUDENTS_ACTIVE",
  "STUDENTS_INACTIVE",
  "BY_COURSE",
  "SPECIFIC_STUDENTS",
  "TEACHERS",
  "ADMINS",
  "ALL_ACTIVE_USERS",
]);

export const emailAudienceFiltersSchema = z
  .object({
    classGroupId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    studentIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .passthrough()
  .optional()
  .nullable();

export const createEmailCampaignSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(200),
    description: z.string().max(500).optional().nullable(),
    audienceType: emailAudienceTypeEnum,
    audienceFilters: emailAudienceFiltersSchema,
    templateId: z.string().uuid().optional().nullable(),
    subject: z.string().max(500).optional().nullable(),
    htmlContent: z.string().max(100_000).optional().nullable(),
    textContent: z.string().max(100_000).optional().nullable(),
    scheduledAt: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.audienceType === "SPECIFIC_STUDENTS") {
      const ids = data.audienceFilters?.studentIds;
      if (!ids || ids.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Selecione ao menos um aluno.",
          path: ["audienceFilters"],
        });
      }
    }
  });

export const updateEmailCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  audienceType: emailAudienceTypeEnum.optional(),
  audienceFilters: emailAudienceFiltersSchema,
  templateId: z.string().uuid().optional().nullable(),
  subject: z.string().max(500).optional().nullable(),
  htmlContent: z.string().max(100_000).optional().nullable(),
  textContent: z.string().max(100_000).optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
});

export const confirmEmailCampaignSchema = z
  .object({
    subject: z.string().min(1, "Assunto é obrigatório").max(500),
    htmlContent: z.string().max(100_000).optional().nullable(),
    textContent: z.string().max(100_000).optional().nullable(),
    sendImmediately: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      const hasHtml = data.htmlContent != null && data.htmlContent.trim() !== "";
      const hasText = data.textContent != null && data.textContent.trim() !== "";
      return hasHtml || hasText;
    },
    { message: "Informe o conteúdo em HTML e/ou texto." }
  );

export const listEmailCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z
    .enum(["DRAFT", "SCHEDULED", "PROCESSING", "SENT", "PARTIALLY_SENT", "FAILED", "CANCELED"])
    .optional(),
  search: z.string().optional(),
});

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(500).optional().nullable(),
  categoryHint: z.string().max(100).optional().nullable(),
  subjectTemplate: z.string().min(1, "Assunto do template é obrigatório").max(500),
  htmlContent: z.string().max(100_000).optional().nullable(),
  textContent: z.string().max(100_000).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  categoryHint: z.string().max(100).optional().nullable(),
  subjectTemplate: z.string().min(1).max(500).optional(),
  htmlContent: z.string().max(100_000).optional().nullable(),
  textContent: z.string().max(100_000).optional().nullable(),
  active: z.boolean().optional(),
});
