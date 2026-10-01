import { ENROLLMENT_HISTORY_BODY_MAX, trimHistoryBody } from "@/lib/enrollment-history";
import { notifyEnrollmentHistoryEntry } from "@/lib/enrollment-history-notifications";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { coordenacaoAuthResponse, requireCoordenacaoViewer, resolveCycle } from "@/lib/coordenacao-access";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};

export async function GET(request: Request) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }

  const params = new URL(request.url).searchParams;
  const cycle = await resolveCycle(params.get("cycleId"));
  const q = params.get("q")?.trim() ?? "";
  const onlyWithHistory = params.get("somenteHistorico") !== "0";
  if (!cycle) return jsonOk({ cycle: null, enrollments: [] });

  const search = q
    ? {
        OR: [
          { student: { name: { contains: q, mode: "insensitive" as const } } },
          { classGroup: { course: { name: { contains: q, mode: "insensitive" as const } } } },
          { classGroup: { teacher: { name: { contains: q, mode: "insensitive" as const } } } },
        ],
      }
    : {};

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroup: { cycleId: cycle.id },
      ...(onlyWithHistory && !q ? { historyEntries: { some: {} } } : {}),
      ...search,
    },
    orderBy: [{ student: { name: "asc" } }],
    take: 120,
    select: {
      id: true,
      status: true,
      student: { select: { name: true } },
      classGroup: {
        select: {
          id: true,
          course: { select: { name: true } },
          teacher: { select: { name: true } },
        },
      },
      historyEntries: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          kind: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  return jsonOk({
    cycle: { id: cycle.id, label: `Ciclo ${cycle.cycle}/${cycle.year}` },
    enrollments: enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      statusLabel: STATUS_LABEL[enrollment.status] ?? enrollment.status,
      studentName: enrollment.student.name,
      courseName: enrollment.classGroup.course.name,
      teacherName: enrollment.classGroup.teacher.name,
      classGroupId: enrollment.classGroup.id,
      history: enrollment.historyEntries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        body: entry.body,
        createdAt: entry.createdAt.toISOString(),
        authorName: entry.author.name,
      })),
    })),
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }

  const body = await request.json().catch(() => null);
  const enrollmentId = typeof body?.enrollmentId === "string" ? body.enrollmentId : "";
  const text = typeof body?.body === "string" ? trimHistoryBody(body.body) : "";
  if (!enrollmentId) return jsonErr("VALIDATION_ERROR", "Matrícula não informada.", 400);
  if (text.length < 2) return jsonErr("VALIDATION_ERROR", "Escreva a informação da busca ativa.", 400);
  if (text.length > ENROLLMENT_HISTORY_BODY_MAX) return jsonErr("VALIDATION_ERROR", "Texto longo demais.", 400);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId },
    select: { id: true },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const created = await prisma.enrollmentHistoryEntry.create({
    data: {
      enrollmentId,
      authorId: user.id,
      kind: "BUSCA_ATIVA",
      body: text,
    },
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  try {
    await notifyEnrollmentHistoryEntry(created.id);
  } catch (error) {
    console.error("[enrollment-history] notificação", error);
  }

  return jsonOk(
    {
      entry: {
        id: created.id,
        kind: created.kind,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        authorName: created.author.name,
      },
    },
    { status: 201 },
  );
}
