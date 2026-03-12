import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 0;
  for (;;) {
    const existing = await prisma.course.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${++n}`;
  }
}

async function ensureUniqueCourseName(sourceName: string): Promise<string> {
  let name = `${sourceName} (cópia)`;
  let n = 1;
  for (;;) {
    const existing = await prisma.course.findUnique({
      where: { name },
      select: { id: true },
    });
    if (!existing) return name;
    n++;
    name = `${sourceName} (cópia ${n})`;
  }
}

/** Duplica um curso com todos os módulos, aulas, exercícios e opções. Apenas MASTER. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
  const { id: sourceCourseId } = await context.params;

  const source = await prisma.course.findUnique({
    where: { id: sourceCourseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: {
              exercises: {
                orderBy: { order: "asc" },
                include: {
                  options: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!source) {
    return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);
  }

  const newName = await ensureUniqueCourseName(source.name);
  const baseSlug = slugify(newName);
  const newSlug = await ensureUniqueSlug(baseSlug);

  const newCourse = await prisma.$transaction(
    async (tx) => {
      const course = await tx.course.create({
        data: {
          name: newName,
          slug: newSlug,
          description: source.description,
          content: source.content,
          imageUrl: source.imageUrl,
          workloadHours: source.workloadHours,
          status: source.status,
        },
      });

      const moduleIdMap = new Map<string, string>();
      for (const mod of source.modules) {
        const newMod = await tx.courseModule.create({
          data: {
            courseId: course.id,
            title: mod.title,
            description: mod.description,
            order: mod.order,
          },
        });
        moduleIdMap.set(mod.id, newMod.id);
      }

      const lessonIdMap = new Map<string, string>();
      for (const mod of source.modules) {
        const newModuleId = moduleIdMap.get(mod.id)!;
        for (const lesson of mod.lessons) {
          const newLesson = await tx.courseLesson.create({
            data: {
              moduleId: newModuleId,
              title: lesson.title,
              order: lesson.order,
              durationMinutes: lesson.durationMinutes,
              videoUrl: lesson.videoUrl,
              imageUrls: lesson.imageUrls,
              contentRich: lesson.contentRich,
              summary: lesson.summary,
              pdfUrl: lesson.pdfUrl,
              attachmentUrls: lesson.attachmentUrls,
              attachmentNames: lesson.attachmentNames,
            },
          });
          lessonIdMap.set(lesson.id, newLesson.id);
        }
      }

      for (const mod of source.modules) {
        for (const lesson of mod.lessons) {
          const newLessonId = lessonIdMap.get(lesson.id)!;
          for (const ex of lesson.exercises) {
            const newEx = await tx.courseLessonExercise.create({
              data: {
                lessonId: newLessonId,
                order: ex.order,
                question: ex.question,
              },
            });
            for (const opt of ex.options) {
              await tx.courseLessonExerciseOption.create({
                data: {
                  exerciseId: newEx.id,
                  order: opt.order,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                },
              });
            }
          }
        }
      }

      return course;
    },
    { timeout: 120_000 }
  );

  await createAuditLog({
    entityType: "Course",
    entityId: newCourse.id,
    action: "DUPLICATE",
    diff: { sourceCourseId, newCourseId: newCourse.id, newName },
    performedByUserId: user.id,
  });

  return jsonOk({ course: newCourse }, { status: 201 });
}
