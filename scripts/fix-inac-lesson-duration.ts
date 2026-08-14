/**
 * INAC ONLY — corrige durationMinutes após fusão de aulas.
 * Manutenção de Celular (16h): 120 min
 * Demais cursos alvo: 75 min
 */
import "../prisma/load-env";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const COURSE_DURATION: Record<string, number> = {
  "Design Gráfico (10h)": 75,
  "Inteligência Artificial (10h)": 75,
  "Manutenção de Celular (16h)": 120,
  "Manutenção de Computador (10h)": 75,
};

function requireInacUrl(): string {
  const url = process.env.APP_DIRECT_URL_INAC?.trim();
  if (!url) throw new Error("APP_DIRECT_URL_INAC não definido");
  if (process.env.APP_DATABASE_URL && url === process.env.APP_DATABASE_URL) {
    throw new Error("APP_DIRECT_URL_INAC = APP_DATABASE_URL — abortando");
  }
  if (process.env.APP_DIRECT_URL && url === process.env.APP_DIRECT_URL) {
    throw new Error("APP_DIRECT_URL_INAC = APP_DIRECT_URL — abortando");
  }
  return url;
}

async function main() {
  const url = requireInacUrl();
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    for (const [name, minutes] of Object.entries(COURSE_DURATION)) {
      const course = await prisma.course.findFirst({
        where: { name },
        select: {
          id: true,
          name: true,
          modules: {
            select: {
              lessons: { select: { id: true, title: true, durationMinutes: true } },
            },
          },
        },
      });
      if (!course) {
        console.warn("NÃO ENCONTRADO:", name);
        continue;
      }
      const lessons = course.modules.flatMap((m) => m.lessons);
      const result = await prisma.courseLesson.updateMany({
        where: { id: { in: lessons.map((l) => l.id) } },
        data: { durationMinutes: minutes },
      });
      console.log(
        `${name}: ${result.count} aulas → ${minutes} min (antes: ${lessons
          .map((l) => l.durationMinutes)
          .join(", ")})`,
      );
    }
    console.log("OK — só INAC.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
