import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { applyAttendanceSuspensionRules } from "@/lib/enrollment-attendance-suspension";
import { processEmailOutboxBatch } from "@/lib/email/outbox";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

async function getTeacherAndSession(
  userId: string,
  classGroupId: string,
  sessionId: string
) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return null;
  const session = await prisma.classSession.findFirst({
    where: { id: sessionId, classGroupId, classGroup: classGroupTeacherAccessWhere(teacher.id) },
    include: {
      classGroup: { select: { teacherId: true } },
    },
  });
  if (!session) return null;
  return { teacher, session };
}

function isDataComplete(st: {
  name: string | null;
  cpf: string | null;
  phone: string | null;
  birthDate: Date | null;
  street: string | null;
  number: string | null;
  city: string | null;
  state: string | null;
}): boolean {
  const name = (st.name ?? "").trim();
  const cpfDigits = (st.cpf ?? "").replace(/\D/g, "");
  const phoneDigits = (st.phone ?? "").replace(/\D/g, "");
  const street = (st.street ?? "").trim();
  const number = (st.number ?? "").trim();
  const city = (st.city ?? "").trim();
  const state = (st.state ?? "").trim();
  return !!(
    name.length > 0 &&
    cpfDigits.length === 11 &&
    phoneDigits.length >= 10 &&
    st.birthDate &&
    street.length > 0 &&
    number.length > 0 &&
    city.length > 0 &&
    state.length > 0
  );
}

/** Lista frequência da sessão (quem esteve presente). Apenas professor dono da turma. Sessão deve ter aula liberada (lessonId). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, sessionId } = await context.params;
  const result = await getTeacherAndSession(user.id, classGroupId, sessionId);
  if (!result) return jsonErr("NOT_FOUND", "Sessão não encontrada.", 404);

  const enrollments = await prisma.enrollment.findMany({
    where: { classGroupId, status: { in: ["ACTIVE", "SUSPENDED"] } },
    orderBy: { student: { name: "asc" } },
    select: {
      id: true,
      status: true,
      student: {
        select: {
          id: true,
          name: true,
          cpf: true,
          phone: true,
          birthDate: true,
          street: true,
          number: true,
          city: true,
          state: true,
          attachments: { select: { type: true } },
        },
      },
    },
  });
  const attendances = await prisma.sessionAttendance.findMany({
    where: { classSessionId: sessionId },
    select: { enrollmentId: true, present: true, absenceJustification: true },
  });
  const byEnrollment = new Map(attendances.map((a) => [a.enrollmentId, a]));

  return jsonOk({
    sessionId,
    attendance: enrollments.map((e) => {
      const st = e.student;
      const hasIdDocument = st.attachments.some((a) => a.type === "ID_DOCUMENT");
      const hasAddressProof = st.attachments.some((a) => a.type === "ADDRESS_PROOF");
      const docsMissing = !hasIdDocument || !hasAddressProof;
      const dataComplete = isDataComplete(st);
      const documentationAlert = docsMissing ? (dataComplete ? "yellow" : "red") : null;
      const row = byEnrollment.get(e.id);
      return {
        enrollmentId: e.id,
        enrollmentStatus: e.status,
        studentName: st.name,
        studentId: st.id,
        present: row?.present ?? false,
        absenceJustification: row?.absenceJustification ?? null,
        documentationAlert,
      };
    }),
  });
}

const MAX_ABSENCE_JUSTIFICATION = 2000;

/** Atualiza frequência da sessão. Body: { attendance: { enrollmentId, present, absenceJustification? }[] }. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, sessionId } = await context.params;
  const result = await getTeacherAndSession(user.id, classGroupId, sessionId);
  if (!result) return jsonErr("NOT_FOUND", "Sessão não encontrada.", 404);
  if (result.session.status !== "LIBERADA") {
    return jsonErr("FORBIDDEN", "Só é possível registrar frequência em sessões com aula liberada.", 403);
  }

  const body = await request.json().catch(() => null);
  const list = Array.isArray(body?.attendance) ? body.attendance : [];

  const parsed: { enrollmentId: string; present: boolean; absenceJustification: string | null }[] = [];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.enrollmentId !== "string" || typeof o.present !== "boolean") continue;
    let absenceJustification: string | null = null;
    if (o.present === false) {
      if (typeof o.absenceJustification === "string") {
        const t = o.absenceJustification.trim().slice(0, MAX_ABSENCE_JUSTIFICATION);
        absenceJustification = t.length > 0 ? t : null;
      }
    }
    parsed.push({ enrollmentId: o.enrollmentId, present: o.present, absenceJustification });
  }

  const enrollmentIds = await prisma.enrollment
    .findMany({
      where: { classGroupId, status: { in: ["ACTIVE", "SUSPENDED"] } },
      select: { id: true },
    })
    .then((r) => r.map((e) => e.id));
  const allowed = new Set(enrollmentIds);

  const savedRows = parsed.filter((x) => allowed.has(x.enrollmentId));

  await prisma.$transaction(
    savedRows.map((x) =>
        prisma.sessionAttendance.upsert({
          where: {
            classSessionId_enrollmentId: {
              classSessionId: sessionId,
              enrollmentId: x.enrollmentId,
            },
          },
          create: {
            classSessionId: sessionId,
            enrollmentId: x.enrollmentId,
            present: x.present,
            absenceJustification: x.present ? null : x.absenceJustification,
          },
          update: {
            present: x.present,
            absenceJustification: x.present ? null : x.absenceJustification,
          },
        })
      )
  );

  const { reactivatedIds, suspendedIds } = await applyAttendanceSuspensionRules({
    classGroupId,
    rows: savedRows,
    performedByUserId: user.id,
  });

  if (suspendedIds.length > 0) {
    await processEmailOutboxBatch(Math.min(25, suspendedIds.length));
  }

  const attendances = await prisma.sessionAttendance.findMany({
    where: { classSessionId: sessionId },
    select: { enrollmentId: true, present: true, absenceJustification: true },
  });
  const byEnrollment = new Map(attendances.map((a) => [a.enrollmentId, a]));
  const enrollmentsAfter = await prisma.enrollment.findMany({
    where: { classGroupId, status: { in: ["ACTIVE", "SUSPENDED"] } },
    orderBy: { student: { name: "asc" } },
    select: {
      id: true,
      status: true,
      student: {
        select: {
          name: true,
          cpf: true,
          phone: true,
          birthDate: true,
          street: true,
          number: true,
          city: true,
          state: true,
          attachments: { select: { type: true } },
        },
      },
    },
  });

  return jsonOk({
    suspendedEnrollmentIds: suspendedIds,
    reactivatedEnrollmentIds: reactivatedIds,
    attendance: enrollmentsAfter.map((e) => {
      const st = e.student;
      const hasIdDocument = st.attachments.some((a) => a.type === "ID_DOCUMENT");
      const hasAddressProof = st.attachments.some((a) => a.type === "ADDRESS_PROOF");
      const docsMissing = !hasIdDocument || !hasAddressProof;
      const dataComplete = isDataComplete(st);
      const documentationAlert = docsMissing ? (dataComplete ? "yellow" : "red") : null;
      const row = byEnrollment.get(e.id);
      return {
        enrollmentId: e.id,
        enrollmentStatus: e.status,
        studentName: st.name,
        present: row?.present ?? false,
        absenceJustification: row?.absenceJustification ?? null,
        documentationAlert,
      };
    }),
  });
}
