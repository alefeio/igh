import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { rowsToCsvSemicolon } from "@/lib/csv-export";

const MAX_ROWS = 10000;

export async function GET() {
  const sessionUser = await requireRole(["TEACHER"]);

  const teacher = await prisma.teacher.findFirst({
    where: { userId: sessionUser.id, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    const empty = rowsToCsvSemicolon(
      [
        "Data",
        "Nome",
        "E-mail",
        "Nota plataforma",
        "Nota aulas",
        "Nota professor",
        "Comentário plataforma",
        "Comentário aulas",
        "Comentário professor",
        "Comentário legado",
        "Indicação",
      ],
      [],
    );
    return new Response(empty, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="avaliacoes-experiencia-vazio.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      classGroup: { teacherId: teacher.id },
      student: { userId: { not: null }, deletedAt: null },
    },
    select: { student: { select: { userId: true } } },
  });

  const studentUserIds = [
    ...new Set(
      enrollments
        .map((e) => e.student.userId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  if (studentUserIds.length === 0) {
    const empty = rowsToCsvSemicolon(
      [
        "Data",
        "Nome",
        "E-mail",
        "Nota plataforma",
        "Nota aulas",
        "Nota professor",
        "Comentário plataforma",
        "Comentário aulas",
        "Comentário professor",
        "Comentário legado",
        "Indicação",
      ],
      [],
    );
    return new Response(empty, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="avaliacoes-experiencia-vazio.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const rows = await prisma.platformExperienceFeedback.findMany({
    where: { userId: { in: studentUserIds } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { user: { select: { name: true, email: true } } },
  });

  const headers = [
    "Data",
    "Nome",
    "E-mail",
    "Nota plataforma",
    "Nota aulas",
    "Nota professor",
    "Comentário plataforma",
    "Comentário aulas",
    "Comentário professor",
    "Comentário legado",
    "Indicação",
  ];

  const dataRows = rows.map((r) => [
    r.createdAt.toISOString(),
    r.user.name,
    r.user.email,
    String(r.ratingPlatform),
    String(r.ratingLessons),
    String(r.ratingTeacher),
    r.commentPlatform ?? "",
    r.commentLessons ?? "",
    r.commentTeacher ?? "",
    r.comment ?? "",
    r.referral ?? "",
  ]);

  const csv = rowsToCsvSemicolon(headers, dataRows);
  const filename = `avaliacoes-minhas-turmas-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
