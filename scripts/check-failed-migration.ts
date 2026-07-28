import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const failed = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; started_at: Date }[]
  >`
    SELECT migration_name, finished_at, rolled_back_at, started_at
    FROM "_prisma_migrations"
    WHERE finished_at IS NULL
       OR migration_name = '20260329100000_enrollment_lesson_passages'
    ORDER BY started_at DESC
    LIMIT 15
  `;

  const tables = await prisma.$queryRaw<{ passage: string | null; enrollment: string | null; lesson: string | null }[]>`
    SELECT
      to_regclass('public."EnrollmentLessonPassage"')::text AS passage,
      to_regclass('public."Enrollment"')::text AS enrollment,
      to_regclass('public."CourseLesson"')::text AS lesson
  `;

  console.log(JSON.stringify({ failed, tables }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
