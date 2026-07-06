import { z } from "zod";

export const ighCommunityTopicKindSchema = z.enum(["IDEA", "TEAM", "DISCUSSION"]);

export const createIghCommunityTopicSchema = z.object({
  kind: ighCommunityTopicKindSchema,
  title: z.string().trim().min(5, "Título: mínimo 5 caracteres.").max(200),
  content: z.string().trim().min(10, "Descreva sua ideia ou mensagem (mín. 10 caracteres).").max(8000),
  tags: z.array(z.string().trim().min(2).max(40)).max(8).optional().default([]),
});

export const createIghCommunityReplySchema = z.object({
  content: z.string().trim().min(2, "Resposta muito curta.").max(4000),
});
