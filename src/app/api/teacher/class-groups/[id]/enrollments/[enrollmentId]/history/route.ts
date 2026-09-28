import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { ENROLLMENT_HISTORY_BODY_MAX, trimHistoryBody } from "@/lib/enrollment-history";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

async function loadOwnedEnrollment(userId: string, classGroupId: string, enrollmentId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return { error: jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403) };
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      classGroupId,
      status: { in: ["ACTIVE", "SUSPENDED", "CANCELLED"] },
      classGroup: classGroupTeacherAccessWhere(teacher.id),
    },
    select: { id: true },
  });
  if (!enrollment) return { error: jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404) };
  return { enrollment };
}

export async function POST(request: Request, ctx: Ctx) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, enrollmentId } = await ctx.params;
  const owned = await loadOwnedEnrollment(user.id, classGroupId, enrollmentId);
  if ("error" in owned && owned.error) return owned.error;

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? trimHistoryBody(body.body) : "";
  if (text.length < 2) {
    return jsonErr("VALIDATION_ERROR", "Escreva a informação da busca ativa.", 400);
  }
  if (text.length > ENROLLMENT_HISTORY_BODY_MAX) {
    return jsonErr("VALIDATION_ERROR", "Texto longo demais.", 400);
  }

  const created = await prisma.enrollmentHistoryEntry.create({
    data: {
      enrollmentId,
      authorId: user.id,
      kind: "BUSCA_ATIVA",
      body: text,
    },
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  return jsonOk(
    {
      entry: {
        id: created.id,
        kind: created.kind,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        authorName: created.author.name,
      },
    },
    { status: 201 },
  );
}
