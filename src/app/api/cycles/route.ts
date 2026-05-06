import { prisma } from "@/lib/prisma";
import { requireRole, requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const createCycleSchema = z.object({
  cycle: z.number().int().positive(),
  year: z.number().int().min(2000).max(3000),
  isVisibleForEnrollments: z.boolean().optional(),
});

export async function GET() {
  // Leitura de ciclos é necessária em matrículas e listagens (inclui TEACHER).
  await requireRole(["ADMIN", "MASTER", "COORDINATOR", "TEACHER"]);
  const cycles = await prisma.cycle.findMany({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
  });
  return jsonOk({ cycles });
}

export async function POST(request: Request) {
  await requireStaffWrite();
  const body = await request.json().catch(() => null);
  const parsed = createCycleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const cycle = await prisma.cycle.create({
      data: {
        cycle: parsed.data.cycle,
        year: parsed.data.year,
        isVisibleForEnrollments: parsed.data.isVisibleForEnrollments ?? false,
      },
    });
    return jsonOk({ cycle }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar ciclo.";
    // Único por (cycle, year)
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("cycle_cycle_year")) {
      return jsonErr("DUPLICATE_CYCLE", "Já existe um ciclo com esse número e ano.", 409);
    }
    return jsonErr("INTERNAL_ERROR", "Falha ao criar ciclo.", 500);
  }
}

