import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  url: z.string().min(5),
  name: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; lessonId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, lessonId } = await context.params;

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, teacherId: teacher.id },
    select: { courseId: true },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const url = parsed.data.url.trim();
  const name = (parsed.data.name ?? "").trim();

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId: cg.courseId } },
    select: { id: true, attachmentUrls: true, attachmentNames: true },
  });
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada neste curso.", 404);

  const nextUrls = [...(lesson.attachmentUrls ?? []), url];
  const nextNames = [...(lesson.attachmentNames ?? [])];
  while (nextNames.length < nextUrls.length - 1) nextNames.push("");
  nextNames.push(name);

  const updated = await prisma.courseLesson.update({
    where: { id: lesson.id },
    data: { attachmentUrls: nextUrls, attachmentNames: nextNames },
    select: { id: true, attachmentUrls: true, attachmentNames: true },
  });

  return jsonOk({
    lesson: {
      id: updated.id,
      attachmentUrls: updated.attachmentUrls ?? [],
      attachmentNames: updated.attachmentNames ?? [],
    },
  });
}

