import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRead } from "@/lib/auth";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";
import { loadExperienceFeedbackTurmaByUserIds } from "@/lib/platform-experience-turma";
import {
  listAdminPlatformExperienceFeedback,
  parseAdminPlatformFeedbackQuery,
} from "@/lib/platform-experience-admin-query";
import { buildPlatformExperiencePdf } from "@/lib/platform-experience-pdf";

const MAX_ROWS = 10000;

function fmtInt(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return n;
}

export async function GET(request: NextRequest) {
  await requireStaffRead();

  const q = parseAdminPlatformFeedbackQuery(request.nextUrl.searchParams);
  const { rows, where } = await listAdminPlatformExperienceFeedback({
    ...q,
    takeLimit: MAX_ROWS,
  });

  const agg = await prisma.platformExperienceFeedback.aggregate({
    where,
    _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
    _min: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
    _max: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
    _count: { id: true },
  });

  const turmaByUser = await loadExperienceFeedbackTurmaByUserIds(rows.map((r) => r.userId));

  const summary = {
    totalCount: agg._count.id,
    avgPlatform: formatExperienceAvg(agg._avg.ratingPlatform),
    minPlatform: fmtInt(agg._min.ratingPlatform),
    maxPlatform: fmtInt(agg._max.ratingPlatform),
    avgLessons: formatExperienceAvg(agg._avg.ratingLessons),
    minLessons: fmtInt(agg._min.ratingLessons),
    maxLessons: fmtInt(agg._max.ratingLessons),
    avgTeacher: formatExperienceAvg(agg._avg.ratingTeacher),
    minTeacher: fmtInt(agg._min.ratingTeacher),
    maxTeacher: fmtInt(agg._max.ratingTeacher),
  };

  const pdfRows = rows.map((r) => {
    const ctx = turmaByUser.get(r.userId) ?? {
      turmaLabel: "—",
      teacherNames: [] as string[],
    };
    const ct = r.commentTeacher?.trim();
    const teacherNamesLine =
      Boolean(ct) && ctx.teacherNames.length > 0 ? ctx.teacherNames.join(", ") : null;
    return {
      dateLabel: new Date(r.createdAt).toLocaleString("pt-BR"),
      userName: r.user.name,
      turmaLabel: ctx.turmaLabel,
      plat: r.ratingPlatform,
      aulas: r.ratingLessons,
      prof: r.ratingTeacher,
      commentPlatform: r.commentPlatform ?? "",
      commentLessons: r.commentLessons ?? "",
      teacherNamesLine,
      commentTeacher: ct ?? "",
      referral: r.referral ?? "",
    };
  });

  const pdfBytes = await buildPlatformExperiencePdf(
    "Avaliacoes de experiencia (administracao)",
    summary,
    pdfRows,
  );
  const filename = `avaliacoes-experiencia-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
