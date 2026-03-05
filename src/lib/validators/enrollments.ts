import { z } from "zod";

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  classGroupId: z.string().uuid(),
});

export const updateEnrollmentSchema = z.object({
  status: z.enum(["ACTIVE", "CANCELLED", "COMPLETED", "SUSPENDED"]).optional(),
  isPreEnrollment: z.boolean().optional(),
  classGroupId: z.string().uuid().optional(),
  certificateUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  certificatePublicId: z.union([z.string(), z.null()]).optional(),
  certificateFileName: z.union([z.string(), z.null()]).optional(),
});
