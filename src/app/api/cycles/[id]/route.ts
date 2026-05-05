import { prisma } from "@/lib/prisma";
import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const updateCycleSchema = z
  .object({
    cycle: z.number().int().positive().optional(),
    year: z.number().int().min(2000).max(3000).optional(),
    isVisibleForEnrollments: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhuma alteração enviada." });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await requireStaffWrite();
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateCycleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const updated = await prisma.cycle.update({
      where: { id },
      data: {
        cycle: parsed.data.cycle,
        year: parsed.data.year,
        isVisibleForEnrollments: parsed.data.isVisibleForEnrollments,
      },
    });
    return jsonOk({ cycle: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao atualizar ciclo.";
    if (msg.toLowerCase().includes("record") && msg.toLowerCase().includes("not found")) {
      return jsonErr("NOT_FOUND", "Ciclo não encontrado.", 404);
    }
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("cycle_cycle_year")) {
      return jsonErr("DUPLICATE_CYCLE", "Já existe um ciclo com esse número e ano.", 409);
    }
    return jsonErr("INTERNAL_ERROR", "Falha ao atualizar ciclo.", 500);
  }
}

