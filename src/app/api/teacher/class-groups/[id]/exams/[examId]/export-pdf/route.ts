import { prisma } from "@/lib/prisma";
import { jsonErr } from "@/lib/http";
import { buildAttemptReview } from "@/lib/class-group-exam-teacher-view";
import {
  buildExamAttemptsPdfBytes,
  type ExamAttemptPdfReview,
} from "@/lib/class-group-exam-export-pdf";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";
import { z } from "zod";

const bodySchema = z.object({
  attemptIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma prova."),
});

type RouteCtx = { params: Promise<{ id: string; examId: string }> };

async function loadReviews(classGroupId: string, examId: string, attemptIds: string[]) {
  const exam = await prisma.classGroupExam.findFirst({
    where: { id: examId, classGroupId },
    select: { title: true },
  });
  if (!exam) return { error: jsonErr("NOT_FOUND", "Prova nao encontrada.", 404) };

  const uniqueIds = [...new Set(attemptIds)];
  const rows = await prisma.classGroupExamAttempt.findMany({
    where: {
      id: { in: uniqueIds },
      examId,
      status: { in: ["SUBMITTED", "EXPIRED", "ABANDONED"] },
    },
    select: { id: true, enrollment: { select: { student: { select: { name: true } } } } },
  });

  if (rows.length === 0) {
    return { error: jsonErr("NOT_FOUND", "Nenhuma prova finalizada encontrada para exportar.", 404) };
  }

  const orderIndex = new Map(uniqueIds.map((id, i) => [id, i]));
  rows.sort((a, b) => {
    const ai = orderIndex.get(a.id) ?? 999;
    const bi = orderIndex.get(b.id) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.enrollment.student.name.localeCompare(b.enrollment.student.name, "pt-BR");
  });

  const reviews: ExamAttemptPdfReview[] = [];
  for (const row of rows) {
    const review = await buildAttemptReview(row.id, classGroupId);
    if (!review) continue;
    reviews.push({
      attempt: {
        studentName: review.attempt.studentName,
        examTitle: review.attempt.examTitle,
        status: review.attempt.status,
        scorePercent: review.attempt.scorePercent,
        correctCount: review.attempt.correctCount,
        totalQuestions: review.attempt.totalQuestions,
        submittedAt: review.attempt.submittedAt,
      },
      questions: review.questions.map((q) => ({
        order: q.order,
        questionText: q.questionText,
        correct: q.correct,
        options: q.options.map((o) => ({
          label: o.label,
          text: o.text,
          isCorrect: o.isCorrect,
          isSelected: o.isSelected,
        })),
      })),
    });
  }

  if (reviews.length === 0) {
    return { error: jsonErr("NOT_FOUND", "Nao foi possivel montar as provas.", 404) };
  }

  return { exam, reviews };
}

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: classGroupId, examId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos.", 400);
  }

  const loaded = await loadReviews(classGroupId, examId, parsed.data.attemptIds);
  if ("error" in loaded) return loaded.error;

  const bytes = await buildExamAttemptsPdfBytes(loaded.exam.title, loaded.reviews);
  const safeName = loaded.exam.title.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "prova";
  const filename = `provas-${safeName}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request, ctx: RouteCtx) {
  const { id: classGroupId, examId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("attemptIds") ?? searchParams.get("ids") ?? "";
  const attemptIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (attemptIds.length === 0) {
    const all = await prisma.classGroupExamAttempt.findMany({
      where: {
        examId,
        exam: { classGroupId },
        status: { in: ["SUBMITTED", "EXPIRED", "ABANDONED"] },
      },
      select: { id: true },
      orderBy: [{ enrollment: { student: { name: "asc" } } }],
    });
    if (all.length === 0) {
      return jsonErr("NOT_FOUND", "Nenhuma prova finalizada para exportar.", 404);
    }
    const loaded = await loadReviews(
      classGroupId,
      examId,
      all.map((a) => a.id)
    );
    if ("error" in loaded) return loaded.error;
    const bytes = await buildExamAttemptsPdfBytes(loaded.exam.title, loaded.reviews);
    const safeName = loaded.exam.title.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "prova";
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="provas-${safeName}-todas.pdf"`,
        "cache-control": "no-store",
      },
    });
  }

  const loaded = await loadReviews(classGroupId, examId, attemptIds);
  if ("error" in loaded) return loaded.error;

  const bytes = await buildExamAttemptsPdfBytes(loaded.exam.title, loaded.reviews);
  const safeName = loaded.exam.title.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "prova";
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="provas-${safeName}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
