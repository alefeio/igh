import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { requireCourseEditAccess } from "@/lib/course-edit-access";
import { prisma } from "@/lib/prisma";
import { courseLessonSchema } from "@/lib/validators/courses";
import { createAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;
  const { user, teacherId } = access;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: { select: { courseId: true, course: { select: { name: true } } } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = courseLessonSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const videoUrl = parsed.data.videoUrl == null || parsed.data.videoUrl === "" ? null : parsed.data.videoUrl.trim() || null;

  const urls = parsed.data.attachmentUrls ?? [];
  const names = (parsed.data.attachmentNames ?? []).slice(0, urls.length).map((s) => String(s).trim());
  while (names.length < urls.length) names.push("");

  let targetModuleId = moduleId;
  if (parsed.data.moduleId && parsed.data.moduleId !== moduleId) {
    const targetModule = await prisma.courseModule.findFirst({
      where: { id: parsed.data.moduleId, courseId },
      select: { id: true },
    });
    if (!targetModule) {
      return jsonErr("VALIDATION_ERROR", "Módulo de destino não encontrado neste curso.", 400);
    }
    targetModuleId = targetModule.id;
  }

  const orderConflict = await prisma.courseLesson.findFirst({
    where: {
      moduleId: targetModuleId,
      order: parsed.data.order,
      id: { not: lessonId },
    },
    select: { id: true },
  });
  if (orderConflict) {
    return jsonErr(
      "VALIDATION_ERROR",
      "Já existe uma aula com esta ordem no módulo selecionado. Altere a ordem antes de salvar.",
      400,
    );
  }

  const before = {
    title: lesson.title,
    order: lesson.order,
    moduleId: lesson.moduleId,
    contentRich: lesson.contentRich,
    summary: lesson.summary,
  };
  const now = new Date();
  const updateData = {
    title: parsed.data.title.trim(),
    order: parsed.data.order,
    ...(targetModuleId !== moduleId ? { moduleId: targetModuleId } : {}),
    durationMinutes: parsed.data.durationMinutes ?? null,
    videoUrl,
    imageUrls: parsed.data.imageUrls ?? [],
    contentRich: parsed.data.contentRich?.trim() || null,
    summary: parsed.data.summary?.trim() || null,
    pdfUrl: parsed.data.pdfUrl?.trim() || null,
    attachmentUrls: urls,
    attachmentNames: names,
    lastEditedByUserId: user.id,
    lastEditedAt: now,
  };

  await prisma.courseLesson.update({
    where: { id: lessonId },
    data: updateData,
  });

  const teacherRecord = teacherId
    ? await prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true } })
    : null;

  await createAuditLog({
    entityType: "CourseLesson",
    entityId: lessonId,
    action: "UPDATE",
    diff: {
      courseId,
      courseName: lesson.module.course.name,
      lessonTitle: lesson.title,
      performedByRole: user.role,
      performedByUserName: user.name,
      ...(teacherId && { teacherId, teacherName: teacherRecord?.name ?? "Professor" }),
      before,
      after: {
        title: updateData.title,
        order: updateData.order,
        moduleId: targetModuleId,
        contentRich: updateData.contentRich,
        summary: updateData.summary,
      },
    },
    performedByUserId: user.id,
  });

  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules, moduleId: targetModuleId });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;
  const { user, teacherId } = access;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: { select: { courseId: true, course: { select: { name: true } } } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const snapshot = {
    title: lesson.title,
    courseId,
    courseName: lesson.module.course.name,
  };
  await prisma.courseLesson.delete({ where: { id: lessonId } });

  await createAuditLog({
    entityType: "CourseLesson",
    entityId: lessonId,
    action: "DELETE",
    diff: {
      ...snapshot,
      performedByRole: user.role,
      ...(teacherId && { teacherId }),
    },
    performedByUserId: user.id,
  });

  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules });
}
