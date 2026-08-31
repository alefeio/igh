/**
 * Análise somente-leitura: distribuição de alunos por nº de cursos distintos concluídos.
 * Descartável — apoia a decisão do corte (2 ou 3 cursos) do mural de multicertificados.
 * Executar: npx tsx tmp/analise-multi-certificacao.ts
 */
import "../prisma/load-env";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString =
  process.env.APP_DIRECT_URL?.trim() ||
  process.env.APP_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("Defina APP_DIRECT_URL ou APP_DATABASE_URL.");

const pool = new pg.Pool({ connectionString, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      certificateEligible: true,
      student: { deletedAt: null },
      classGroup: { status: "ENCERRADA" },
    },
    select: {
      studentId: true,
      certificateIssuedAt: true,
      student: { select: { name: true } },
      classGroup: { select: { courseId: true, course: { select: { name: true } } } },
    },
  });

  const byStudent = new Map<
    string,
    { name: string; courseIds: Set<string>; courseNames: Set<string>; lastAt: Date | null }
  >();

  for (const e of enrollments) {
    const cur =
      byStudent.get(e.studentId) ??
      { name: e.student.name, courseIds: new Set<string>(), courseNames: new Set<string>(), lastAt: null };
    cur.courseIds.add(e.classGroup.courseId);
    if (e.classGroup.course?.name) cur.courseNames.add(e.classGroup.course.name);
    if (e.certificateIssuedAt && (!cur.lastAt || e.certificateIssuedAt > cur.lastAt)) {
      cur.lastAt = e.certificateIssuedAt;
    }
    byStudent.set(e.studentId, cur);
  }

  const dist = new Map<number, number>();
  for (const s of byStudent.values()) {
    const n = s.courseIds.size;
    dist.set(n, (dist.get(n) ?? 0) + 1);
  }

  const totalStudents = await prisma.student.count({ where: { deletedAt: null } });

  console.log(`\nMatrículas aptas em turma ENCERRADA: ${enrollments.length}`);
  console.log(`Alunos com ao menos 1 curso concluído: ${byStudent.size}`);
  console.log(`Total de alunos cadastrados (não excluídos): ${totalStudents}`);

  console.log(`\nDistribuição por nº de cursos distintos concluídos:`);
  for (const n of Array.from(dist.keys()).sort((a, b) => a - b)) {
    console.log(`  ${n} curso(s): ${dist.get(n)} aluno(s)`);
  }

  const atLeast = (min: number) =>
    Array.from(byStudent.values()).filter((s) => s.courseIds.size >= min).length;
  console.log(`\nElegíveis ao mural:`);
  for (const min of [2, 3, 4, 5]) {
    console.log(`  >= ${min} cursos: ${atLeast(min)} aluno(s)`);
  }

  const top = Array.from(byStudent.values())
    .sort((a, b) => b.courseIds.size - a.courseIds.size)
    .slice(0, 15);
  console.log(`\nTop 15 (nome abreviado):`);
  for (const s of top) {
    const parts = s.name.trim().split(/\s+/);
    const display = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    console.log(
      `  ${String(s.courseIds.size).padStart(2)} cursos — ${display} — último: ${
        s.lastAt ? s.lastAt.toISOString().slice(0, 10) : "sem data"
      }`,
    );
  }

  const eligibleNoEncerrada = await prisma.enrollment.count({
    where: { certificateEligible: true, classGroup: { status: { not: "ENCERRADA" } } },
  });
  console.log(`\n(Contexto: ${eligibleNoEncerrada} matrículas aptas em turmas ainda não encerradas.)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
