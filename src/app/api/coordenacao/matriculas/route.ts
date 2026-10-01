import { jsonOk } from "@/lib/http";
import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";
import { enrollmentOccupiesSeat } from "@/lib/enrollment-seat";
import { prisma } from "@/lib/prisma";
import {
  coordenacaoAuthResponse,
  listCycles,
  requireCoordenacaoViewer,
  resolveCycle,
} from "@/lib/coordenacao-access";

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
  return `${names[Number(month) - 1] ?? month}/${year?.slice(2) ?? ""}`;
}

function locationLabel(group: {
  location: string | null;
  poloLocation: { name: string; polo: { name: string } | null } | null;
}) {
  const polo = group.poloLocation?.polo?.name?.trim();
  const local = group.poloLocation?.name?.trim() || group.location?.trim();
  if (polo && local) return `${polo} · ${local}`;
  return local || polo || "Sem local";
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
    return jsonOk({ cycles: [], cycle: null, kpis: null });
  }

  const groups = await prisma.classGroup.findMany({
    where: { cycleId: cycle.id },
    select: {
      id: true,
      status: true,
      capacity: true,
      location: true,
      startTime: true,
      course: { select: { name: true } },
      teacher: { select: { name: true } },
      poloLocation: { select: { name: true, polo: { select: { name: true } } } },
      _count: {
        select: { waitlistEntries: { where: { status: "WAITING" } } },
      },
    },
  });
  const groupIds = groups.map((group) => group.id);
  if (groupIds.length === 0) {
    return jsonOk({
      cycles: cycles.map((item) => ({
        id: item.id,
        label: `Ciclo ${item.cycle}/${item.year}`,
        current: item.isVisibleForEnrollments,
      })),
      cycle: { id: cycle.id, label: `Ciclo ${cycle.cycle}/${cycle.year}` },
      kpis: {
        total: 0,
        active: 0,
        preEnrollment: 0,
        confirmed: 0,
        suspended: 0,
        cancelled: 0,
        cancelRate: 0,
        completed: 0,
        waitlist: 0,
        openSeats: 0,
        occupancyPercent: 0,
        classes: 0,
        lowOccupancyClasses: 0,
        attendanceAverage: null,
        below70: 0,
        occupyingWithoutBusca: 0,
        certificateEligible: 0,
        certificateIssued: 0,
        closedBase: 0,
      },
      statusPie: [],
      confirmationPie: [],
      attendancePie: [],
      timeline: [],
      courseColumns: [],
      placeColumns: [],
      classStatusColumns: [],
      attentionClasses: [],
    });
  }
  const [enrollments, buscaRows] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classGroupId: { in: groupIds } },
      select: {
        id: true,
        status: true,
        isPreEnrollment: true,
        certificateEligible: true,
        certificateIssuedAt: true,
        enrolledAt: true,
        classGroupId: true,
      },
    }),
    prisma.enrollmentHistoryEntry.groupBy({
      by: ["enrollmentId"],
      where: { kind: "BUSCA_ATIVA", enrollment: { classGroupId: { in: groupIds } } },
      _count: { id: true },
    }),
  ]);

  const occupyingIds = enrollments.filter((row) => enrollmentOccupiesSeat(row.status)).map((row) => row.id);
  const attendance = await getEnrollmentAttendanceSummaries(occupyingIds);
  const buscaByEnrollment = new Set(buscaRows.map((row) => row.enrollmentId));
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const byStatus = new Map<string, number>();
  const courseStack = new Map<string, { ativas: number; canceladas: number; concluidas: number }>();
  const monthNew = new Map<string, number>();
  const placeMap = new Map<string, number>();
  let preEnrollment = 0;
  let certificateEligible = 0;
  let certificateIssued = 0;
  let closedBase = 0;
  let below70 = 0;
  let attendanceKnown = 0;
  let attendanceSum = 0;
  let occupyingWithoutBusca = 0;

  for (const row of enrollments) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    const group = groupById.get(row.classGroupId);
    const course = group?.course.name ?? "Curso";
    const stack = courseStack.get(course) ?? { ativas: 0, canceladas: 0, concluidas: 0 };
    if (enrollmentOccupiesSeat(row.status)) stack.ativas += 1;
    else if (row.status === "CANCELLED") stack.canceladas += 1;
    else if (row.status === "COMPLETED") stack.concluidas += 1;
    courseStack.set(course, stack);

    const key = monthKey(row.enrolledAt);
    monthNew.set(key, (monthNew.get(key) ?? 0) + 1);

    if (row.isPreEnrollment && row.status === "ACTIVE") preEnrollment += 1;
    if (group?.status === "ENCERRADA" && enrollmentOccupiesSeat(row.status)) {
      closedBase += 1;
      if (row.certificateEligible) certificateEligible += 1;
      if (row.certificateIssuedAt) certificateIssued += 1;
    }
    if (enrollmentOccupiesSeat(row.status)) {
      const percent = attendance.get(row.id)?.percent;
      if (percent != null) {
        attendanceKnown += 1;
        attendanceSum += percent;
        if (percent < 70) below70 += 1;
      }
      if (!buscaByEnrollment.has(row.id)) occupyingWithoutBusca += 1;
    }
  }

  const seats = groups.reduce(
    (acc, group) => {
      const enrolled = enrollments.filter(
        (row) => row.classGroupId === group.id && enrollmentOccupiesSeat(row.status),
      ).length;
      acc.capacity += group.capacity;
      acc.occupied += enrolled;
      const label = locationLabel(group);
      placeMap.set(label, (placeMap.get(label) ?? 0) + enrolled);
      return acc;
    },
    { capacity: 0, occupied: 0 },
  );

  const classRows = groups
    .filter((group) => group.status === "ABERTA" || group.status === "EM_ANDAMENTO" || group.status === "PLANEJADA")
    .map((group) => {
      const enrolled = enrollments.filter(
        (row) => row.classGroupId === group.id && enrollmentOccupiesSeat(row.status),
      ).length;
      return {
        id: group.id,
        course: group.course.name,
        teacher: group.teacher.name,
        place: locationLabel(group),
        status: CLASS_STATUS_LABEL[group.status] ?? group.status,
        enrolled,
        capacity: group.capacity,
        occupancy: group.capacity > 0 ? Math.round((enrolled / group.capacity) * 100) : 0,
        waitlist: group._count.waitlistEntries,
        startTime: group.startTime,
      };
    })
    .sort((a, b) => a.occupancy - b.occupancy || b.waitlist - a.waitlist);

  const openSeats = Math.max(0, seats.capacity - seats.occupied);
  const total = enrollments.length;
  const active = byStatus.get("ACTIVE") ?? 0;
  const cancelled = byStatus.get("CANCELLED") ?? 0;
  const bands = { abaixo50: 0, entre50e69: 0, aPartir70: 0, semAula: occupyingIds.length - attendanceKnown };
  for (const id of occupyingIds) {
    const percent = attendance.get(id)?.percent;
    if (percent == null) continue;
    if (percent < 50) bands.abaixo50 += 1;
    else if (percent < 70) bands.entre50e69 += 1;
    else bands.aPartir70 += 1;
  }

  const timelineKeys = [...monthNew.keys()].sort();
  let cumulative = 0;
  const timeline = timelineKeys.map((key) => {
    const novas = monthNew.get(key) ?? 0;
    cumulative += novas;
    return { name: monthLabel(key), novas, acumulado: cumulative };
  });

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
      preEnrollment,
      confirmed: Math.max(0, active - preEnrollment),
      suspended: byStatus.get("SUSPENDED") ?? 0,
      cancelled,
      cancelRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
      completed: byStatus.get("COMPLETED") ?? 0,
      waitlist: groups.reduce((sum, group) => sum + group._count.waitlistEntries, 0),
      openSeats,
      occupancyPercent: seats.capacity > 0 ? Math.round((seats.occupied / seats.capacity) * 100) : 0,
      classes: groups.length,
      lowOccupancyClasses: classRows.filter((row) => row.occupancy < 50).length,
      attendanceAverage: attendanceKnown > 0 ? Math.round(attendanceSum / attendanceKnown) : null,
      below70,
      occupyingWithoutBusca,
      certificateEligible,
      certificateIssued,
      closedBase,
    },
    statusPie: ["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"]
      .map((status) => ({ name: STATUS_LABEL[status] ?? status, value: byStatus.get(status) ?? 0 }))
      .filter((row) => row.value > 0),
    confirmationPie: [
      { name: "Confirmadas", value: Math.max(0, active - preEnrollment) },
      { name: "Pré-matrículas", value: preEnrollment },
    ].filter((row) => row.value > 0),
    attendancePie: [
      { name: "Abaixo de 50%", value: bands.abaixo50 },
      { name: "50% a 69%", value: bands.entre50e69 },
      { name: "70% ou mais", value: bands.aPartir70 },
      { name: "Sem aula lançada", value: bands.semAula },
    ].filter((row) => row.value > 0),
    timeline,
    courseColumns: [...courseStack.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.ativas + b.canceladas - (a.ativas + a.canceladas))
      .slice(0, 10),
    placeColumns: [...placeMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    classStatusColumns: [...new Set(groups.map((group) => group.status))].map((status) => ({
      name: CLASS_STATUS_LABEL[status] ?? status,
      value: groups.filter((group) => group.status === status).length,
    })),
    attentionClasses: classRows.slice(0, 8),
  });
}
