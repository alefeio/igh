import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const pending = await prisma.pendingTestimonial.findUnique({ where: { id } });
  if (!pending) {
    return jsonErr("NOT_FOUND", "Depoimento pendente não encontrado.", 404);
  }
  if (pending.status !== "pending") {
    return jsonErr("INVALID_STATE", "Este depoimento já foi processado.", 409);
  }

  if (parsed.data.action === "reject") {
    await prisma.pendingTestimonial.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      },
    });
    return jsonOk({ message: "Depoimento rejeitado." });
  }

  const maxOrder = await prisma.siteTestimonial.aggregate({ _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  await prisma.$transaction([
    prisma.siteTestimonial.create({
      data: {
        name: pending.name,
        roleOrContext: pending.roleOrContext,
        quote: pending.quote,
        photoUrl: pending.photoUrl,
        order: nextOrder,
        isActive: true,
      },
    }),
    prisma.pendingTestimonial.update({
      where: { id },
      data: {
        status: "approved",
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      },
    }),
  ]);

  return jsonOk({ message: "Depoimento aprovado e publicado." });
}
