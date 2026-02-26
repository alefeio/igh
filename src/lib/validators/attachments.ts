import { z } from "zod";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export const createAttachmentSchema = z.object({
  type: z.enum(["ID_DOCUMENT", "ADDRESS_PROOF"]),
  publicId: z.string().min(1, "publicId é obrigatório"),
  url: z.string().url("URL inválida").refine((u) => u.startsWith("https://"), "URL deve ser HTTPS"),
  fileName: z.string().optional(),
  mimeType: z
    .string()
    .optional()
    .refine((v) => !v || ALLOWED_MIME.includes(v as (typeof ALLOWED_MIME)[number]), "Tipo de arquivo não permitido (PDF, JPG, PNG)"),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .refine((v) => v == null || v <= MAX_SIZE_BYTES, `Tamanho máximo: ${MAX_SIZE_BYTES / 1024 / 1024}MB`),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

export const ALLOWED_MIME_TYPES = ALLOWED_MIME;
export const MAX_ATTACHMENT_SIZE_BYTES = MAX_SIZE_BYTES;
