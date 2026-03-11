import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { requireCourseEditAccess } from "@/lib/course-edit-access";
import { prisma } from "@/lib/prisma";
import { courseLessonSchema } from "@/lib/validators/courses";
import { createAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string; moduleId: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id: courseId, moduleId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;
  const { user, teacherId } = access;

  const moduleRow = await prisma.courseModule.findFirst({
    where: { id: moduleId, courseId },
    include: { course: { select: { name: true } } },
  });
  if (!moduleRow) {
    return jsonErr("NOT_FOUND", "Módulo não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = courseLessonSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const urls = parsed.data.attachmentUrls ?? [];
  const names = (parsed.data.attachmentNames ?? []).slice(0, urls.length).map((s) => String(s).trim());
  while (names.length < urls.length) names.push("");

  const now = new Date();
  const newLesson = await prisma.courseLesson.create({
    data: {
      moduleId,
      title: parsed.data.title.trim(),
      order: parsed.data.order,
      durationMinutes: parsed.data.durationMinutes ?? null,
      videoUrl: parsed.data.videoUrl?.trim() || null,
      imageUrls: parsed.data.imageUrls ?? [],
      contentRich: parsed.data.contentRich?.trim() || null,
      summary: parsed.data.summary?.trim() || null,
      pdfUrl: parsed.data.pdfUrl?.trim() || null,
      attachmentUrls: urls,
      attachmentNames: names,
      lastEditedByUserId: user.id,
      lastEditedAt: now,
    },
  });

  const teacherRecord =
    teacherId ? await prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true } }) : null;
  await createAuditLog({
    entityType: "CourseLesson",
    entityId: newLesson.id,
    action: "CREATE",
    diff: {
      courseId,
      courseName: moduleRow.course.name,
      lessonTitle: newLesson.title,
      performedByRole: user.role,
      performedByUserName: user.name,
      ...(teacherId && { teacherId, teacherName: teacherRecord?.name ?? "Professor" }),
    },
    performedByUserId: user.id,
  });

  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules, lesson: { id: newLesson.id, title: newLesson.title, order: newLesson.order, durationMinutes: newLesson.durationMinutes, videoUrl: newLesson.videoUrl, imageUrls: newLesson.imageUrls, contentRich: newLesson.contentRich, summary: newLesson.summary, pdfUrl: newLesson.pdfUrl, attachmentUrls: newLesson.attachmentUrls, attachmentNames: newLesson.attachmentNames } }, { status: 201 });
}
