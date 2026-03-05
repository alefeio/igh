import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const body = await _request.json().catch(() => null);
  const action = body && typeof body === "object" && "action" in body ? (body as { action: string }).action : null;
  if (action !== "approve" && action !== "reject") {
    return jsonErr("VALIDATION_ERROR", "Informe action: 'approve' ou 'reject'.", 400);
  }

  const pending = await prisma.pendingTestimonial.findUnique({
    where: { id },
  });
  if (!pending) {
    return jsonErr("NOT_FOUND", "Depoimento pendente não encontrado.", 404);
  }
  if (pending.status !== "pending") {
    return jsonErr("VALIDATION_ERROR", "Este depoimento já foi avaliado.", 400);
  }

  if (action === "reject") {
    await prisma.pendingTestimonial.update({
      where: { id },
      data: { status: "rejected", reviewedByUserId: user.id, reviewedAt: new Date() },
    });
    return jsonOk({ ok: true, message: "Depoimento rejeitado." });
  }

  const maxOrder = await prisma.siteTestimonial.aggregate({ _max: { order: true } });
  await prisma.siteTestimonial.create({
    data: {
      name: pending.name,
      roleOrContext: pending.roleOrContext,
      quote: pending.quote,
      photoUrl: pending.photoUrl,
      order: (maxOrder._max.order ?? -1) + 1,
      isActive: true,
    },
  });

  await prisma.pendingTestimonial.update({
    where: { id },
    data: { status: "approved", reviewedByUserId: user.id, reviewedAt: new Date() },
  });

  return jsonOk({ ok: true, message: "Depoimento aprovado e publicado." });
}
