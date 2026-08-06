import "server-only";

import { prisma } from "@/lib/prisma";

export const COURSE_BACKUP_FORMAT = "course-backup-v1" as const;

export type CourseBackupOption = {
  id: string;
  order: number;
  text: string;
  isCorrect: boolean;
};

export type CourseBackupExercise = {
  id: string;
  order: number;
  question: string;
  answerJustification: string | null;
  options: CourseBackupOption[];
};

export type CourseBackupLesson = {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
  contentRich: string | null;
  videoUrl: string | null;
  imageUrls: string[];
  pdfUrl: string | null;
  attachmentUrls: string[];
  attachmentNames: string[];
  summary: string | null;
  exercises: CourseBackupExercise[];
};

export type CourseBackupModule = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: CourseBackupLesson[];
};

export type CourseBackupCourse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  workloadHours: number | null;
  status: "ACTIVE" | "INACTIVE" | "NOT_LISTED";
  modules: CourseBackupModule[];
};

export type CourseBackupPayload = {
  format: typeof COURSE_BACKUP_FORMAT;
  exportedAt: string;
  courses: CourseBackupCourse[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolveUniqueName(desired: string, keepCourseId: string): Promise<string> {
  let name = desired;
  let n = 0;
  for (;;) {
    const existing = await prisma.course.findFirst({
      where: { name, NOT: { id: keepCourseId } },
      select: { id: true },
    });
    if (!existing) return name;
    n += 1;
    name = n === 1 ? `${desired} (import)` : `${desired} (import ${n})`;
  }
}

async function resolveUniqueSlug(desired: string, keepCourseId: string): Promise<string> {
  const base = slugify(desired) || "curso";
  let slug = base;
  let n = 0;
  for (;;) {
    const existing = await prisma.course.findFirst({
      where: { slug, NOT: { id: keepCourseId } },
      select: { id: true },
    });
    if (!existing) return slug;
    n += 1;
    slug = n === 1 ? `${base}-import` : `${base}-import-${n}`;
  }
}

/** Exporta cursos selecionados (conteúdo pedagógico apenas). */
export async function exportCoursesBackup(courseIds: string[]): Promise<CourseBackupPayload> {
  const uniqueIds = [...new Set(courseIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new Error("Selecione ao menos um curso.");
  }

  const rows = await prisma.course.findMany({
    where: { id: { in: uniqueIds } },
    orderBy: { name: "asc" },
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

  if (rows.length === 0) {
    throw new Error("Nenhum dos cursos selecionados foi encontrado.");
  }

  const courses: CourseBackupCourse[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    content: c.content,
    imageUrl: c.imageUrl,
    workloadHours: c.workloadHours,
    status: c.status,
    modules: c.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        order: l.order,
        durationMinutes: l.durationMinutes,
        contentRich: l.contentRich,
        videoUrl: l.videoUrl,
        imageUrls: l.imageUrls ?? [],
        pdfUrl: l.pdfUrl,
        attachmentUrls: l.attachmentUrls ?? [],
        attachmentNames: l.attachmentNames ?? [],
        summary: l.summary,
        exercises: l.exercises.map((ex) => ({
          id: ex.id,
          order: ex.order,
          question: ex.question,
          answerJustification: ex.answerJustification,
          options: ex.options.map((opt) => ({
            id: opt.id,
            order: opt.order,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
        })),
      })),
    })),
  }));

  return {
    format: COURSE_BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    courses,
  };
}

export function parseCourseBackupPayload(raw: unknown): CourseBackupPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Arquivo inválido.");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== COURSE_BACKUP_FORMAT) {
    throw new Error(`Formato não suportado. Esperado ${COURSE_BACKUP_FORMAT}.`);
  }
  if (!Array.isArray(obj.courses) || obj.courses.length === 0) {
    throw new Error("Backup sem cursos.");
  }
  return obj as CourseBackupPayload;
}

export type ImportCoursesResult = {
  imported: number;
  created: number;
  updated: number;
  courseIds: string[];
};

/**
 * Importa backup com upsert por ID.
 * Se o curso já existe, remove módulos (cascade) e recria a árvore preservando IDs.
 */
export async function importCoursesBackup(
  payload: CourseBackupPayload,
  options?: { createdByUserId?: string },
): Promise<ImportCoursesResult> {
  const parsed = parseCourseBackupPayload(payload);
  let created = 0;
  let updated = 0;
  const courseIds: string[] = [];

  for (const course of parsed.courses) {
    if (!course?.id || !course.name || !course.slug) {
      throw new Error("Curso do backup sem id/name/slug.");
    }

    const name = await resolveUniqueName(course.name, course.id);
    const slug = await resolveUniqueSlug(course.slug, course.id);
    const status =
      course.status === "INACTIVE" || course.status === "NOT_LISTED" ? course.status : "ACTIVE";

    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.course.findUnique({
          where: { id: course.id },
          select: { id: true },
        });

        if (existing) {
          await tx.course.update({
            where: { id: course.id },
            data: {
              name,
              slug,
              description: course.description ?? null,
              content: course.content ?? null,
              imageUrl: course.imageUrl ?? null,
              workloadHours: course.workloadHours ?? null,
              status,
            },
          });
          // Cascade remove lessons/exercises/options; progresso de aluno nessas aulas também some se houver FK cascade.
          await tx.courseModule.deleteMany({ where: { courseId: course.id } });
          updated += 1;
        } else {
          await tx.course.create({
            data: {
              id: course.id,
              name,
              slug,
              description: course.description ?? null,
              content: course.content ?? null,
              imageUrl: course.imageUrl ?? null,
              workloadHours: course.workloadHours ?? null,
              status,
              createdByUserId: options?.createdByUserId ?? null,
            },
          });
          created += 1;
        }

        for (const mod of course.modules ?? []) {
          await tx.courseModule.create({
            data: {
              id: mod.id,
              courseId: course.id,
              title: mod.title,
              description: mod.description ?? null,
              order: mod.order,
            },
          });

          for (const lesson of mod.lessons ?? []) {
            await tx.courseLesson.create({
              data: {
                id: lesson.id,
                moduleId: mod.id,
                title: lesson.title,
                order: lesson.order,
                durationMinutes: lesson.durationMinutes ?? null,
                contentRich: lesson.contentRich ?? null,
                videoUrl: lesson.videoUrl ?? null,
                imageUrls: lesson.imageUrls ?? [],
                pdfUrl: lesson.pdfUrl ?? null,
                attachmentUrls: lesson.attachmentUrls ?? [],
                attachmentNames: lesson.attachmentNames ?? [],
                summary: lesson.summary ?? null,
                lastEditedByUserId: null,
                lastEditedAt: null,
              },
            });

            for (const ex of lesson.exercises ?? []) {
              await tx.courseLessonExercise.create({
                data: {
                  id: ex.id,
                  lessonId: lesson.id,
                  order: ex.order,
                  question: ex.question,
                  answerJustification: ex.answerJustification ?? null,
                },
              });

              for (const opt of ex.options ?? []) {
                await tx.courseLessonExerciseOption.create({
                  data: {
                    id: opt.id,
                    exerciseId: ex.id,
                    order: opt.order,
                    text: opt.text,
                    isCorrect: Boolean(opt.isCorrect),
                  },
                });
              }
            }
          }
        }
      },
      { timeout: 180_000 },
    );

    courseIds.push(course.id);
  }

  return {
    imported: courseIds.length,
    created,
    updated,
    courseIds,
  };
}
