import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { listCycles, requireCoordenacaoViewer, resolveCycle, coordenacaoAuthResponse } from "@/lib/coordenacao-access";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativas",
  SUSPENDED: "Suspensas",
  CANCELLED: "Canceladas",
  COMPLETED: "Concluídas",
};

const CLASS_STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejadas",
  ABERTA: "Abertas",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerradas",
  CANCELADA: "Canceladas",
};

function monthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(month) - 1]}/${year.slice(2)}`;
}

function topWithOther(rows: { name: string; value: number }[], limit = 8) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((sum, row) => sum + row.value, 0);
  if (rest > 0) head.push({ name: "Outros", value: rest });
  return head;
}

export async function GET(request: Request) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }

  const requested = new URL(request.url).searchParams.get("cycleId");
  const [cycles, cycle] = await Promise.all([listCycles(), resolveCycle(requested)]);
  if (!cycle) {
    return jsonOk({
      cycles: [],
      cycle: null,
      kpis: null,
      statusPie: [],
      courseColumns: [],
      teacherColumns: [],
      classStatusColumns: [],
      timeline: [],
    });
  }

  const cycleWhere = { classGroup: { cycleId: cycle.id } };
  const [statusGroups, groups, enrolledAt, waitlist, buscaAtiva, cancelledRecent] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["status"],
      where: cycleWhere,
      _count: { id: true },
    }),
    prisma.classGroup.findMany({
      where: { cycleId: cycle.id },
      select: {
        status: true,
        capacity: true,
        teacher: { select: { name: true } },
        course: { select: { name: true } },
        _count: {
          select: {
            enrollments: { where: { status: { in: ["ACTIVE", "SUSPENDED", "COMPLETED"] } } },
          },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: cycleWhere,
      select: { enrolledAt: true },
    }),
    prisma.enrollmentWaitlist.count({
      where: { status: "WAITING", classGroup: { cycleId: cycle.id } },
    }),
    prisma.enrollmentHistoryEntry.count({
      where: { kind: "BUSCA_ATIVA", enrollment: cycleWhere },
    }),
    prisma.enrollment.count({
      where: { ...cycleWhere, status: "CANCELLED" },
    }),
  ]);

  const byStatus = new Map(statusGroups.map((row) => [row.status, row._count.id]));
  const total = statusGroups.reduce((sum, row) => sum + row._count.id, 0);
  const active = byStatus.get("ACTIVE") ?? 0;
  const suspended = byStatus.get("SUSPENDED") ?? 0;
  const completed = byStatus.get("COMPLETED") ?? 0;
  const capacity = groups.reduce((sum, group) => sum + group.capacity, 0);
  const occupied = groups.reduce((sum, group) => sum + group._count.enrollments, 0);

  const courseMap = new Map<string, number>();
  const teacherMap = new Map<string, number>();
  const classStatusMap = new Map<string, number>();
  for (const group of groups) {
    courseMap.set(group.course.name, (courseMap.get(group.course.name) ?? 0) + group._count.enrollments);
    teacherMap.set(group.teacher.name, (teacherMap.get(group.teacher.name) ?? 0) + group._count.enrollments);
    classStatusMap.set(group.status, (classStatusMap.get(group.status) ?? 0) + 1);
  }

  const monthMap = new Map<string, number>();
  for (const row of enrolledAt) {
    const key = monthKey(row.enrolledAt);
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }
  const timeline = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ name: monthLabel(key), value }));

  return jsonOk({
    cycles: cycles.map((item) => ({
      id: item.id,
      label: `Ciclo ${item.cycle}/${item.year}`,
      current: item.isVisibleForEnrollments,
    })),
    cycle: { id: cycle.id, label: `Ciclo ${cycle.cycle}/${cycle.year}` },
    kpis: {
      total,
      active,
      suspended,
      completed,
      cancelled: cancelledRecent,
      waitlist,
      buscaAtiva,
      classes: groups.length,
      occupancyPercent: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
    },
    statusPie: ["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"]
      .map((status) => ({ name: STATUS_LABEL[status] ?? status, value: byStatus.get(status) ?? 0 }))
      .filter((row) => row.value > 0),
    courseColumns: topWithOther(
      [...courseMap.entries()].map(([name, value]) => ({ name, value })),
    ),
    teacherColumns: topWithOther(
      [...teacherMap.entries()].map(([name, value]) => ({ name, value })),
    ),
    classStatusColumns: [...classStatusMap.entries()].map(([status, value]) => ({
      name: CLASS_STATUS_LABEL[status] ?? status,
      value,
    })),
    timeline,
  });
}
