import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { applyClassGroupAutomaticStatusUpdatesCached } from "@/lib/class-group-auto-status";
import type { Prisma } from "@/generated/prisma/client";
import {
  isTeacherClassGroupTab,
  statusesForTeacherClassGroupTab,
} from "@/lib/teacher-class-group-tabs";

/** Lista turmas do professor (só as dele) ou todas, para o Administrador Pedagógico. Query: ?tab=em_andamento|planejadas|encerradas|canceladas */
export async function GET(request: Request) {
  const user = await requireRole(["TEACHER", "ADMIN"]);
  await applyClassGroupAutomaticStatusUpdatesCached();

  const tab = new URL(request.url).searchParams.get("tab") ?? "em_andamento";
  const statuses = isTeacherClassGroupTab(tab) ? statusesForTeacherClassGroupTab(tab)! : statusesForTeacherClassGroupTab("em_andamento")!;

  let teacherFilter: Prisma.ClassGroupWhereInput = {};
  if (user.role !== "ADMIN") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      return jsonOk({ classGroups: [], tab });
    }
    teacherFilter = classGroupTeacherAccessWhere(teacher.id);
  }
  const classGroups = await prisma.classGroup.findMany({
    where: {
      ...teacherFilter,
      status: { in: statuses },
    },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      capacity: true,
      status: true,
      location: true,
      course: { select: { id: true, name: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: ["ACTIVE", "SUSPENDED"] } } },
        },
      },
    },
  });
  return jsonOk({
    tab,
    classGroups: classGroups.map((cg) => ({
      id: cg.id,
      courseId: cg.course.id,
      courseName: cg.course.name,
      startDate: cg.startDate,
      endDate: cg.endDate,
      daysOfWeek: cg.daysOfWeek,
      startTime: cg.startTime,
      endTime: cg.endTime,
      capacity: cg.capacity,
      status: cg.status,
      location: cg.location,
      enrollmentsCount: cg._count.enrollments,
    })),
  });
}
