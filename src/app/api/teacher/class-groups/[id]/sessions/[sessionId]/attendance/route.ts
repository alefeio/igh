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
    where: { id: sessionId, classGroupId },
    include: {
      classGroup: { select: { teacherId: true } },
    },
  });
  if (!session || session.classGroup.teacherId !== teacher.id) return null;
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
    where: { classGroupId, status: "ACTIVE" },
    orderBy: { student: { name: "asc" } },
    select: {
      id: true,
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
    select: { enrollmentId: true, present: true },
  });
  const byEnrollment = new Map(attendances.map((a) => [a.enrollmentId, a.present]));

  return jsonOk({
    sessionId,
    attendance: enrollments.map((e) => {
      const st = e.student;
      const hasIdDocument = st.attachments.some((a) => a.type === "ID_DOCUMENT");
      const hasAddressProof = st.attachments.some((a) => a.type === "ADDRESS_PROOF");
      const docsMissing = !hasIdDocument || !hasAddressProof;
      const dataComplete = isDataComplete(st);
      const documentationAlert = docsMissing ? (dataComplete ? "yellow" : "red") : null;
      return {
        enrollmentId: e.id,
        studentName: st.name,
        studentId: st.id,
        present: byEnrollment.get(e.id) ?? false,
        documentationAlert,
      };
    }),
  });
}

/** Atualiza frequência da sessão. Body: { attendance: { enrollmentId: string, present: boolean }[] }. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, sessionId } = await context.params;
  const result = await getTeacherAndSession(user.id, classGroupId, sessionId);
  if (!result) return jsonErr("NOT_FOUND", "Sessão não encontrada.", 404);
  if (!result.session.lessonId) {
    return jsonErr("FORBIDDEN", "Só é possível registrar frequência em sessões com aula liberada.", 403);
  }

  const body = await request.json().catch(() => null);
  const list = Array.isArray(body?.attendance) ? body.attendance : [];
  const valid = list.filter(
    (x: unknown) =>
      x &&
      typeof x === "object" &&
      typeof (x as { enrollmentId?: string }).enrollmentId === "string" &&
      typeof (x as { present?: boolean }).present === "boolean"
  );

  const enrollmentIds = await prisma.enrollment
    .findMany({
      where: { classGroupId, status: "ACTIVE" },
      select: { id: true },
    })
    .then((r) => r.map((e) => e.id));
  const allowed = new Set(enrollmentIds);

  await prisma.$transaction(
    valid
      .filter((x: { enrollmentId: string; present: boolean }) => allowed.has(x.enrollmentId))
      .map((x: { enrollmentId: string; present: boolean }) =>
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
          },
          update: { present: x.present },
        })
      )
  );

  const attendances = await prisma.sessionAttendance.findMany({
    where: { classSessionId: sessionId },
    select: { enrollmentId: true, present: true },
  });
  const byEnrollment = new Map(attendances.map((a) => [a.enrollmentId, a.present]));
  const enrollmentsAfter = await prisma.enrollment.findMany({
    where: { classGroupId, status: "ACTIVE" },
    orderBy: { student: { name: "asc" } },
    select: {
      id: true,
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
    attendance: enrollmentsAfter.map((e) => {
      const st = e.student;
      const hasIdDocument = st.attachments.some((a) => a.type === "ID_DOCUMENT");
      const hasAddressProof = st.attachments.some((a) => a.type === "ADDRESS_PROOF");
      const docsMissing = !hasIdDocument || !hasAddressProof;
      const dataComplete = isDataComplete(st);
      const documentationAlert = docsMissing ? (dataComplete ? "yellow" : "red") : null;
      return {
        enrollmentId: e.id,
        studentName: st.name,
        present: byEnrollment.get(e.id) ?? false,
        documentationAlert,
      };
    }),
  });
}
