import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { rowsToCsvSemicolon } from "@/lib/csv-export";

const MAX_ROWS = 10000;

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

  const rows = await prisma.platformExperienceFeedback.findMany({
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
  const filename = `avaliacoes-experiencia-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
