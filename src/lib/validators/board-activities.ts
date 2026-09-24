import { z } from "zod";
import {
  BOARD_COMMENT_MAX_LEN,
  BOARD_DESCRIPTION_MAX_LEN,
  BOARD_REACTION_EMOJIS,
  BOARD_TITLE_MAX_LEN,
} from "@/lib/board-activities";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)");

export const createBoardActivitySchema = z.object({
  title: z.string().trim().min(2, "Título obrigatório").max(BOARD_TITLE_MAX_LEN),
  description: z
    .string()
    .trim()
    .max(BOARD_DESCRIPTION_MAX_LEN)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  assigneeId: z.string().uuid("Responsável inválido"),
  plannedStartAt: dateOnly,
  plannedEndAt: dateOnly.optional().nullable(),
});

export const updateBoardActivitySchema = z.object({
  title: z.string().trim().min(2).max(BOARD_TITLE_MAX_LEN).optional(),
  description: z
    .string()
    .trim()
    .max(BOARD_DESCRIPTION_MAX_LEN)
    .optional()
    .nullable(),
  assigneeId: z.string().uuid().optional(),
  plannedStartAt: dateOnly.optional(),
  plannedEndAt: dateOnly.optional().nullable(),
  version: z.number().int().positive().optional(),
});

export const moveBoardActivitySchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]),
  version: z.number().int().positive().optional(),
});

export const boardCommentSchema = z.object({
  body: z.string().trim().min(1, "Comentário vazio").max(BOARD_COMMENT_MAX_LEN),
});

export const boardReactionSchema = z.object({
  emoji: z.enum(BOARD_REACTION_EMOJIS),
});

export const boardReassignSchema = z.object({
  assigneeId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export const boardCreatePermissionSchema = z.object({
  canCreateBoardTasks: z.boolean(),
});
