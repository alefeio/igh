import { getSessionUserFromCookie } from "@/lib/auth";
import {
  isBuscaAtivaEligible,
  MESSAGE_TEMPLATES,
  parseAdministrativeRecord,
  type MessageContext,
} from "@/lib/busca-ativa";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user)
    return jsonErr("UNAUTHENTICATED", "Entre na sua conta para acessar a busca ativa.", 401);
  if (user.role !== "TEACHER")
    return jsonErr("FORBIDDEN", "Acesso reservado aos professores.", 403);
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);
  const url = new URL(request.url);
  const classGroupId = url.searchParams.get("classGroupId");
  const enrollmentId = url.searchParams.get("enrollmentId");
  if (!classGroupId)
    return jsonErr("VALIDATION_ERROR", "Abra uma turma para acessar a busca ativa.", 400);
  const group = await prisma.classGroup.findFirst({
    where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
    select: {
      id: true,
      updatedAt: true,
      startTime: true,
      endTime: true,
      daysOfWeek: true,
      location: true,
      whatsappGroupUrl: true,
      course: { select: { id: true, name: true, updatedAt: true } },
      cycle: { select: { cycle: true, year: true, updatedAt: true } },
      poloLocation: { select: { name: true, updatedAt: true } },
    },
  });
  if (!group) return jsonErr("NOT_FOUND", "Turma não encontrada ou sem permissão.", 404);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId,
      id: enrollmentId ?? undefined,
      // Espelha a lista de alunos da turma; elegibilidade para contato é independente.
      status: { in: ["ACTIVE", "SUSPENDED", "CANCELLED"] },
    },
    orderBy: { student: { name: "asc" } },
    select: {
      id: true,
      status: true,
      isPreEnrollment: true,
      updatedAt: true,
      student: { select: { id: true, name: true, phone: true, updatedAt: true, deletedAt: true } },
      _count: { select: { historyEntries: { where: { kind: "BUSCA_ATIVA" } } } },
      historyEntries: {
        where: { kind: "BUSCA_ATIVA" },
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
  if (enrollmentId && enrollments.length !== 1)
    return jsonErr("NOT_FOUND", "Matrícula não encontrada nesta turma.", 404);
  const attendance = await getEnrollmentAttendanceSummaries(enrollments.map((e) => e.id));
  const base = {
    classGroupId: group.id,
    courseId: group.course.id,
    courseName: group.course.name,
    turmaNome: `${group.course.name} · Ciclo ${group.cycle.cycle}/${group.cycle.year} · ${group.poloLocation?.name ?? group.location ?? "local não informado"}`,
    daysOfWeek: group.daysOfWeek,
    startTime: group.startTime,
    endTime: group.endTime,
    location: group.location,
    unidadeNome: group.poloLocation?.name ?? null,
    whatsappGroupUrl: group.whatsappGroupUrl,
    professorNome: user.name,
  };
  const groupRevision = [
    user.id,
    user.name,
    group.updatedAt.toISOString(),
    group.course.updatedAt.toISOString(),
    group.cycle.updatedAt.toISOString(),
    group.poloLocation?.updatedAt.toISOString() ?? "",
  ].join(":");
  const contexts: MessageContext[] = enrollments.map((e) => ({
    ...base,
    revision: [
      groupRevision,
      e.updatedAt.toISOString(),
      e.student.updatedAt.toISOString(),
      attendance.get(e.id)?.presentCount ?? 0,
      attendance.get(e.id)?.recordedCount ?? 0,
      attendance.get(e.id)?.totalSessions ?? 0,
      attendance.get(e.id)?.unjustifiedAbsenceCount ?? 0,
    ].join(":"),
    enrollmentId: e.id,
    studentId: e.student.id,
    studentName: e.student.name ?? "",
    studentPhone: e.student.phone,
    status: e.status,
    contactEligible: isBuscaAtivaEligible({
      status: e.status,
      isPreEnrollment: e.isPreEnrollment,
      studentDeletedAt: e.student.deletedAt,
    }),
    isPreEnrollment: e.isPreEnrollment,
    studentUnavailable: Boolean(e.student.deletedAt),
    hasBuscaAtiva: e._count.historyEntries > 0,
    attendancePresentCount: attendance.get(e.id)?.presentCount ?? 0,
    attendanceRecordedCount: attendance.get(e.id)?.recordedCount ?? 0,
    attendanceTotalSessions: attendance.get(e.id)?.totalSessions ?? 0,
    attendanceUnjustifiedAbsenceCount: attendance.get(e.id)?.unjustifiedAbsenceCount ?? 0,
    history: e.historyEntries.flatMap((h) => {
      const record = parseAdministrativeRecord(h.body);
      return record &&
        (record.contactType === "CONTATO_REALIZADO" || record.contactType === "RETORNO_INFORMADO")
        ? [
            {
              id: h.id,
              kind: h.kind,
              body: h.body,
              createdAt: h.createdAt.toISOString(),
              authorName: h.author.name,
              ...record,
            },
          ]
        : [];
    }),
  }));
  const groupContext: MessageContext = { ...base, revision: groupRevision };
  return jsonOk(
    {
      group: groupContext,
      enrollments: contexts,
      templates: MESSAGE_TEMPLATES.map(({ id, version }) => ({ id, version })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
