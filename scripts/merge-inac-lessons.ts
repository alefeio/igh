/**
 * INAC ONLY — funde aulas pares (2→1, 4→3, …) nos cursos listados.
 *
 * Uso:
 *   npx tsx scripts/merge-inac-lessons.ts           # dry-run (só lista)
 *   npx tsx scripts/merge-inac-lessons.ts --apply   # aplica no APP_DIRECT_URL_INAC
 *
 * Nunca usa APP_DATABASE_URL / APP_DIRECT_URL (IGH).
 */
import "../prisma/load-env";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const TARGET_COURSE_NAMES = [
  "Design Gráfico (10h)",
  "Inteligência Artificial (10h)",
  "Manutenção de Celular (16h)",
  "Manutenção de Computador (10h)",
] as const;

const APPLY = process.argv.includes("--apply");

function requireInacUrl(): string {
  const url = process.env.APP_DIRECT_URL_INAC?.trim();
  if (!url) {
    throw new Error("APP_DIRECT_URL_INAC não definido no .env — abortando (não usamos o banco IGH).");
  }
  // Guarda-extra: se alguém apontar a variável errada para o mesmo host do IGH, ainda exige o nome da env.
  if (process.env.APP_DATABASE_URL && url === process.env.APP_DATABASE_URL) {
    throw new Error("APP_DIRECT_URL_INAC é igual a APP_DATABASE_URL — recusando para não alterar o IGH.");
  }
  if (process.env.APP_DIRECT_URL && url === process.env.APP_DIRECT_URL) {
    throw new Error("APP_DIRECT_URL_INAC é igual a APP_DIRECT_URL — recusando para não alterar o IGH.");
  }
  return url;
}

function hostHint(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return "(URL inválida)";
  }
}

function joinText(a: string | null | undefined, b: string | null | undefined, sep: string): string | null {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return `${left}${sep}${right}`;
}

function mergeRichContent(a: string | null | undefined, bTitle: string, b: string | null | undefined): string | null {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left && !right) return null;
  if (!right) return left || null;
  if (!left) return right;
  const heading = `<h2>${escapeHtml(bTitle)}</h2>`;
  return `${left}\n\n<hr />\n${heading}\n${right}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function newTitle(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!right || left === right) return left;
  // Evita títulos enormes
  const combined = `${left} · ${right}`;
  return combined.length <= 180 ? combined : `${left.slice(0, 80)} · ${right.slice(0, 80)}`;
}

async function main() {
  const url = requireInacUrl();
  console.log("=== Banco: APP_DIRECT_URL_INAC ===");
  console.log("Host:", hostHint(url));
  console.log("Modo:", APPLY ? "APPLY (grava)" : "DRY-RUN (somente leitura)");

  const pool = new pg.Pool({ connectionString: url, max: 3 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const courses = await prisma.course.findMany({
      where: { name: { in: [...TARGET_COURSE_NAMES] } },
      select: {
        id: true,
        name: true,
        workloadHours: true,
        status: true,
        modules: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            order: true,
            lessons: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                order: true,
                summary: true,
                durationMinutes: true,
                contentRich: true,
                videoUrl: true,
                pdfUrl: true,
                imageUrls: true,
                attachmentUrls: true,
                attachmentNames: true,
                _count: {
                  select: {
                    exercises: true,
                    classSessions: true,
                    lessonProgress: true,
                    lessonNotes: true,
                    lessonFavorites: true,
                    lessonPassages: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const byName = new Map(courses.map((c) => [c.name, c]));
    for (const name of TARGET_COURSE_NAMES) {
      if (!byName.has(name)) console.warn("NÃO ENCONTRADO no INAC:", name);
    }

    for (const name of TARGET_COURSE_NAMES) {
      const course = byName.get(name);
      if (!course) continue;

      type Flat = (typeof course.modules)[number]["lessons"][number] & {
        moduleId: string;
        moduleOrder: number;
        moduleTitle: string;
      };

      const flat: Flat[] = [];
      for (const m of course.modules) {
        for (const l of m.lessons) {
          flat.push({
            ...l,
            moduleId: m.id,
            moduleOrder: m.order,
            moduleTitle: m.title,
          });
        }
      }

      console.log(`\n### ${course.name} (${flat.length} aulas → ${Math.ceil(flat.length / 2)})`);
      for (let i = 0; i < flat.length; i += 2) {
        const keep = flat[i]!;
        const drop = flat[i + 1];
        if (!drop) {
          console.log(`  manter sozinha: [${keep.order}] ${keep.title}`);
          continue;
        }
        console.log(
          `  fundir: [${keep.moduleOrder}:${keep.order}] "${keep.title}"  +  [${drop.moduleOrder}:${drop.order}] "${drop.title}"`,
        );
        console.log(
          `         → título: "${newTitle(keep.title, drop.title)}" | sessões drop=${drop._count.classSessions} progress=${drop._count.lessonProgress}`,
        );
      }

      if (!APPLY) continue;

      // Já fundido? (idempotente — evita 8→4 se rodar --apply de novo)
      if (flat.length <= 8) {
        console.log(`  (já tem ${flat.length} aulas — pulando)`);
        continue;
      }

      const pairs: { keepId: string; dropId: string }[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        const keep = flat[i]!;
        const drop = flat[i + 1];
        if (!drop) continue;
        pairs.push({ keepId: keep.id, dropId: drop.id });
      }

      for (const { keepId, dropId } of pairs) {
        await prisma.$transaction(
          async (tx) => {
            const keep = await tx.courseLesson.findUnique({ where: { id: keepId } });
            const drop = await tx.courseLesson.findUnique({ where: { id: dropId } });
            if (!keep || !drop) return; // já processado / ausente

            const title = newTitle(keep.title, drop.title);
            const summary = joinText(keep.summary, drop.summary, "\n\n");
            const contentRich = mergeRichContent(keep.contentRich, drop.title, drop.contentRich);
            const imageUrls = [...(keep.imageUrls ?? []), ...(drop.imageUrls ?? [])];
            const attachmentUrls = [...(keep.attachmentUrls ?? []), ...(drop.attachmentUrls ?? [])];
            const attachmentNames = [...(keep.attachmentNames ?? []), ...(drop.attachmentNames ?? [])];

            let contentExtra = contentRich;
            if (drop.videoUrl && drop.videoUrl !== keep.videoUrl) {
              const note = `<p><strong>Vídeo (parte 2):</strong> <a href="${escapeHtml(drop.videoUrl)}">${escapeHtml(drop.videoUrl)}</a></p>`;
              contentExtra = contentExtra ? `${contentExtra}\n${note}` : note;
            }
            if (drop.pdfUrl && drop.pdfUrl !== keep.pdfUrl) {
              const note = `<p><strong>PDF (parte 2):</strong> <a href="${escapeHtml(drop.pdfUrl)}">${escapeHtml(drop.pdfUrl)}</a></p>`;
              contentExtra = contentExtra ? `${contentExtra}\n${note}` : note;
            }

            await tx.courseLesson.update({
              where: { id: keepId },
              data: {
                title,
                summary,
                contentRich: contentExtra,
                // Mantém a duração da aula original (não soma as duas partes).
                durationMinutes: keep.durationMinutes,
                imageUrls,
                attachmentUrls,
                attachmentNames,
                lastEditedAt: new Date(),
              },
            });

            const maxEx = await tx.courseLessonExercise.aggregate({
              where: { lessonId: keepId },
              _max: { order: true },
            });
            let nextExOrder = (maxEx._max.order ?? -1) + 1;
            const dropExercises = await tx.courseLessonExercise.findMany({
              where: { lessonId: dropId },
              orderBy: { order: "asc" },
              select: { id: true },
            });
            for (const ex of dropExercises) {
              await tx.courseLessonExercise.update({
                where: { id: ex.id },
                data: { lessonId: keepId, order: nextExOrder++ },
              });
            }

            await tx.classSession.updateMany({
              where: { lessonId: dropId },
              data: { lessonId: keepId },
            });

            const dropFavs = await tx.enrollmentLessonFavorite.findMany({ where: { lessonId: dropId } });
            for (const fav of dropFavs) {
              const exists = await tx.enrollmentLessonFavorite.findUnique({
                where: {
                  enrollmentId_lessonId: { enrollmentId: fav.enrollmentId, lessonId: keepId },
                },
              });
              if (exists) {
                await tx.enrollmentLessonFavorite.delete({ where: { id: fav.id } });
              } else {
                await tx.enrollmentLessonFavorite.update({
                  where: { id: fav.id },
                  data: { lessonId: keepId },
                });
              }
            }

            const dropProgress = await tx.enrollmentLessonProgress.findMany({
              where: { lessonId: dropId },
            });
            for (const p of dropProgress) {
              const keepP = await tx.enrollmentLessonProgress.findUnique({
                where: {
                  enrollmentId_lessonId: { enrollmentId: p.enrollmentId, lessonId: keepId },
                },
              });
              if (!keepP) {
                await tx.enrollmentLessonProgress.update({
                  where: { id: p.id },
                  data: { lessonId: keepId },
                });
                continue;
              }
              await tx.enrollmentLessonProgress.update({
                where: { id: keepP.id },
                data: {
                  completed: keepP.completed || p.completed,
                  completedAt: keepP.completedAt ?? p.completedAt,
                  lastAccessedAt:
                    keepP.lastAccessedAt && p.lastAccessedAt
                      ? keepP.lastAccessedAt > p.lastAccessedAt
                        ? keepP.lastAccessedAt
                        : p.lastAccessedAt
                      : (keepP.lastAccessedAt ?? p.lastAccessedAt),
                  totalMinutesStudied: (keepP.totalMinutesStudied ?? 0) + (p.totalMinutesStudied ?? 0),
                  percentWatched: Math.max(keepP.percentWatched ?? 0, p.percentWatched ?? 0),
                  percentRead: Math.max(keepP.percentRead ?? 0, p.percentRead ?? 0),
                },
              });
              await tx.enrollmentLessonProgress.delete({ where: { id: p.id } });
            }

            await tx.enrollmentLessonNote.updateMany({
              where: { lessonId: dropId },
              data: { lessonId: keepId },
            });
            await tx.enrollmentLessonPassage.updateMany({
              where: { lessonId: dropId },
              data: { lessonId: keepId },
            });
            await tx.enrollmentLessonQuestion.updateMany({
              where: { lessonId: dropId },
              data: { lessonId: keepId },
            });

            await tx.courseLesson.delete({ where: { id: dropId } });
          },
          { maxWait: 20_000, timeout: 60_000 },
        );
      }

      // Reordena aulas restantes por módulo (0..n-1)
      await prisma.$transaction(
        async (tx) => {
          const modules = await tx.courseModule.findMany({
            where: { courseId: course.id },
            orderBy: { order: "asc" },
            select: {
              id: true,
              lessons: { orderBy: { order: "asc" }, select: { id: true } },
            },
          });

          for (const m of modules) {
            let tmp = 10_000;
            for (const l of m.lessons) {
              await tx.courseLesson.update({ where: { id: l.id }, data: { order: tmp++ } });
            }
            let ord = 0;
            for (const l of m.lessons) {
              await tx.courseLesson.update({ where: { id: l.id }, data: { order: ord++ } });
            }
          }

          for (const m of modules) {
            const count = await tx.courseLesson.count({ where: { moduleId: m.id } });
            if (count === 0) {
              await tx.courseModule.delete({ where: { id: m.id } });
            }
          }
        },
        { maxWait: 20_000, timeout: 60_000 },
      );

      const after = await prisma.courseLesson.count({
        where: { module: { courseId: course.id } },
      });
      console.log(`  ✓ aplicado: agora ${after} aulas`);
    }

    console.log("\nConcluído.", APPLY ? "Alterações gravadas no INAC." : "Nenhuma alteração (dry-run).");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
