import { z } from "zod";

export const createWaitlistSchema = z.object({
  studentId: z.string().uuid(),
  classGroupId: z.string().uuid(),
  notes: z.string().max(500).optional(),
  referrerUserId: z.string().uuid().optional().nullable(),
});

export const createPublicWaitlistSchema = z.object({
  classGroupId: z.string().uuid(),
  studentToken: z.string().min(1).optional(),
  referrerUserId: z.string().uuid().optional().nullable(),
  referralCode: z.string().optional().nullable(),
});
