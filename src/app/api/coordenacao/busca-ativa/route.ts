import { ENROLLMENT_HISTORY_BODY_MAX, trimHistoryBody } from "@/lib/enrollment-history";
import { notifyEnrollmentHistoryEntry } from "@/lib/enrollment-history-notifications";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { coordenacaoAuthResponse, listCycles, requireBuscaAtivaUser, resolveCycle } from "@/lib/coordenacao-access";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};

function toHistory(entry: {
  id: string;
  kind: string;
  body: string;
  createdAt: Date;
  author: { name: string };
}) {
  return {
    id: entry.id,
    kind: entry.kind,
    body: entry.body,
    createdAt: entry.createdAt.toISOString(),
    authorName: entry.author.name,
  };
}

export async function GET(request: Request) {
  try {
    await requireBuscaAtivaUser();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }

  const params = new URL(request.url).searchParams;
  const [cycleRows, cycle] = await Promise.all([listCycles(), resolveCycle(params.get("cycleId"))]);
  const cycles = cycleRows.map((item) => ({
    id: item.id,
    label: `Ciclo ${item.cycle}/${item.year}`,
    current: item.isVisibleForEnrollments,
  }));
  const q = params.get("q")?.trim() ?? "";
  const classGroupId = params.get("classGroupId")?.trim() ?? "";
  const teacherId = params.get("teacherId")?.trim() ?? "";
  if (!cycle) {
    return jsonOk({ cycles, cycle: null, teachers: [], classGroups: [], view: "cronologico", feed: [], enrollments: [] });
  }

  const classGroups = await prisma.classGroup.findMany({
    where: { cycleId: cycle.id },
    orderBy: [{ course: { name: "asc" } }, { startTime: "asc" }],
    select: {
      id: true,
      startTime: true,
      location: true,
      course: { select: { name: true } },
      teacher: { select: { id: true, name: true } },
    },
  });

  const teachers = [...new Map(classGroups.map((group) => [group.teacher.id, group.teacher])).values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const visibleGroups = teacherId
    ? classGroups.filter(
        (group) => group.teacher.id === teacherId,
      )
    : classGroups;
  const selectedGroup = visibleGroups.find((group) => group.id === classGroupId) ?? null;

  const catalog = {
    cycles,
    cycle: { id: cycle.id, label: `Ciclo ${cycle.cycle}/${cycle.year}` },
    teachers,
    classGroups: visibleGroups.map((group) => ({
      id: group.id,
      teacherId: group.teacher.id,
      teacherName: group.teacher.name,
      courseName: group.course.name,
      label: [group.course.name, group.teacher.name, group.startTime, group.location?.trim()]
        .filter(Boolean)
        .join(" · "),
    })),
  };

  if (selectedGroup) {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        classGroupId: selectedGroup.id,
        ...(q ? { student: { name: { contains: q, mode: "insensitive" } } } : {}),
      },
      orderBy: [{ student: { name: "asc" } }],
      select: {
        id: true,
        status: true,
        student: { select: { name: true } },
        historyEntries: {
          orderBy: { createdAt: "desc" },
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
      ...catalog,
      view: "turma",
      selectedClassGroupId: selectedGroup.id,
      feed: [],
      enrollments: enrollments.map((enrollment) => ({
        id: enrollment.id,
        status: enrollment.status,
        statusLabel: STATUS_LABEL[enrollment.status] ?? enrollment.status,
        studentName: enrollment.student.name,
        courseName: selectedGroup.course.name,
        teacherName: selectedGroup.teacher.name,
        classGroupId: selectedGroup.id,
        history: enrollment.historyEntries.map(toHistory),
      })),
    });
  }

  const entries = await prisma.enrollmentHistoryEntry.findMany({
    where: {
      enrollment: {
        classGroup: {
          cycleId: cycle.id,
          ...(teacherId ? { teacherId } : {}),
        },
        ...(q ? { student: { name: { contains: q, mode: "insensitive" } } } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
      enrollment: {
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
        },
      },
    },
  });

  return jsonOk({
    ...catalog,
    view: "cronologico",
    selectedClassGroupId: null,
    enrollments: [],
    feed: entries.map((entry) => ({
      ...toHistory(entry),
      enrollmentId: entry.enrollment.id,
      statusLabel: STATUS_LABEL[entry.enrollment.status] ?? entry.enrollment.status,
      studentName: entry.enrollment.student.name,
      courseName: entry.enrollment.classGroup.course.name,
      teacherName: entry.enrollment.classGroup.teacher.name,
      classGroupId: entry.enrollment.classGroup.id,
    })),
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireBuscaAtivaUser();
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
