import { z } from "zod";

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  classGroupId: z.string().uuid(),
  /** Usuário que indicou o aluno (opcional; só grava se ainda não houver StudentReferral). */
  referrerUserId: z.string().uuid().optional().nullable(),
});

export const updateEnrollmentSchema = z.object({
  status: z.enum(["ACTIVE", "CANCELLED", "COMPLETED", "SUSPENDED"]).optional(),
  isPreEnrollment: z.boolean().optional(),
  classGroupId: z.string().uuid().optional(),
  /** Troca de aluno — apenas Master / Administrador Geral (validado na rota). */
  studentId: z.string().uuid().optional(),
  certificateUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  certificatePublicId: z.union([z.string(), z.null()]).optional(),
  certificateFileName: z.union([z.string(), z.null()]).optional(),
});
