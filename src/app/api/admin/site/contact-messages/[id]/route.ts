import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  replied: z.boolean(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Mensagem não encontrada.", 404);

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { repliedAt: parsed.data.replied ? new Date() : null },
  });

  return jsonOk({
    repliedAt: updated.repliedAt?.toISOString() ?? null,
  });
}
