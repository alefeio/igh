import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

type Progress = {
  completed: boolean;
  percentWatched: number;
  percentRead: number;
  completedAt: string | null;
  lastAccessedAt: string | null;
  totalMinutesStudied: number;
  lastContentPageIndex: number | null;
};

/** Retorna o progresso da aula para a matrícula. Apenas STUDENT; aula deve estar liberada para a turma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: {
      classGroup: {
        select: { courseId: true },
      },
    },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const progress = await prisma.enrollmentLessonProgress.findUnique({
    where: {
      enrollmentId_lessonId: { enrollmentId, lessonId },
    },
  });

  const data: Progress = progress
    ? {
        completed: progress.completed,
        percentWatched: Math.min(100, Math.max(0, progress.percentWatched)),
        percentRead: Math.min(100, Math.max(0, progress.percentRead)),
        completedAt: progress.completedAt?.toISOString() ?? null,
        lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
        totalMinutesStudied: progress.totalMinutesStudied ?? 0,
        lastContentPageIndex: progress.lastContentPageIndex ?? null,
      }
    : {
        completed: false,
        percentWatched: 0,
        percentRead: 0,
        completedAt: null,
        lastAccessedAt: null,
        totalMinutesStudied: 0,
        lastContentPageIndex: null,
      };

  return jsonOk(data);
}

/** Percentual mínimo assistido para marcar a aula como concluída automaticamente. */
const MIN_PERCENT_TO_AUTO_COMPLETE = 80;

/** Atualiza o progresso (percentuais e/ou marcar como concluída). Apenas STUDENT. Conclusão automática ao atingir MIN_PERCENT_TO_AUTO_COMPLETE. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: {
      classGroup: {
        select: { courseId: true },
      },
    },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  let body: {
    completed?: boolean;
    percentWatched?: number;
    percentRead?: number;
    studyMinutesDelta?: number;
    lastContentPageIndex?: number | null;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }

  const percentWatched =
    body.percentWatched !== undefined
      ? Math.min(100, Math.max(0, Math.round(Number(body.percentWatched))))
      : undefined;
  const percentRead =
    body.percentRead !== undefined
      ? Math.min(100, Math.max(0, Math.round(Number(body.percentRead))))
      : undefined;
  const completedByUser = body.completed === true;
  const autoComplete =
    percentWatched !== undefined && percentWatched >= MIN_PERCENT_TO_AUTO_COMPLETE;
  const completed = completedByUser || autoComplete;

  const now = new Date();
  const studyDelta = Math.max(
    0,
    Math.min(1440, Math.round(Number(body.studyMinutesDelta ?? 0)))
  );
  const lastContentPageIndex =
    body.lastContentPageIndex !== undefined
      ? body.lastContentPageIndex === null
        ? null
        : Math.max(0, Math.round(Number(body.lastContentPageIndex)))
      : undefined;

  const progress = await prisma.enrollmentLessonProgress.upsert({
    where: {
      enrollmentId_lessonId: { enrollmentId, lessonId },
    },
    create: {
      enrollmentId,
      lessonId,
      completed,
      percentWatched: percentWatched ?? 0,
      percentRead: percentRead ?? 0,
      completedAt: completed ? now : null,
      lastAccessedAt: now,
      totalMinutesStudied: studyDelta,
      lastContentPageIndex: completed ? null : (lastContentPageIndex ?? null),
      updatedAt: now,
    },
    update: {
      ...(percentWatched !== undefined && { percentWatched }),
      ...(percentRead !== undefined && { percentRead }),
      ...(completed && {
        completed: true,
        completedAt: now,
        lastContentPageIndex: null,
      }),
      lastAccessedAt: now,
      ...(studyDelta > 0 && {
        totalMinutesStudied: { increment: studyDelta },
      }),
      ...(lastContentPageIndex !== undefined && { lastContentPageIndex: lastContentPageIndex }),
      updatedAt: now,
    },
  });

  return jsonOk({
    completed: progress.completed,
    percentWatched: Math.min(100, Math.max(0, progress.percentWatched)),
    percentRead: Math.min(100, Math.max(0, progress.percentRead)),
    completedAt: progress.completedAt?.toISOString() ?? null,
    lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
    totalMinutesStudied: progress.totalMinutesStudied,
    lastContentPageIndex: progress.lastContentPageIndex ?? null,
  });
}

/** Mesmo que PATCH; usado com sendBeacon ao sair da página (garante envio). */
export async function POST(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  return PATCH(request, context);
}
