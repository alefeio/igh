import type { NextRequest } from "next/server";
import { requireStaffRead } from "@/lib/auth";
import { rowsToCsvSemicolon } from "@/lib/csv-export";
import { loadExperienceFeedbackTurmaByUserIds } from "@/lib/platform-experience-turma";
import {
  listAdminPlatformExperienceFeedback,
  parseAdminPlatformFeedbackQuery,
} from "@/lib/platform-experience-admin-query";

const MAX_ROWS = 10000;

export async function GET(request: NextRequest) {
  await requireStaffRead();

  const q = parseAdminPlatformFeedbackQuery(request.nextUrl.searchParams);
  const { rows } = await listAdminPlatformExperienceFeedback({
    ...q,
    takeLimit: MAX_ROWS,
  });

  const turmaByUser = await loadExperienceFeedbackTurmaByUserIds(
    rows.map((r) => r.userId),
  );

  const headers = [
    "Data",
    "Nome",
    "E-mail",
    "Turma (curso, local, dias, horário)",
    "Professor(es) — contexto",
    "Nota plataforma",
    "Nota aulas",
    "Nota professor",
    "Comentário plataforma",
    "Comentário aulas",
    "Comentário sobre o professor",
    "Indicação",
  ];

  const dataRows = rows.map((r) => {
    const ctx = turmaByUser.get(r.userId) ?? {
      turmaLabel: "",
      teacherNames: [] as string[],
    };
    return [
      r.createdAt.toISOString(),
      r.user.name,
      r.user.email,
      ctx.turmaLabel === "—" ? "" : ctx.turmaLabel,
      ctx.teacherNames.join(", "),
      String(r.ratingPlatform),
      String(r.ratingLessons),
      String(r.ratingTeacher),
      r.commentPlatform ?? "",
      r.commentLessons ?? "",
      r.commentTeacher ?? "",
      r.referral ?? "",
    ];
  });

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
