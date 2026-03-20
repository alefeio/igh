import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista alunos (matrículas ativas) da turma. Apenas professor dono da turma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findUnique({
    where: { id: classGroupId, teacherId: teacher.id },
    select: { id: true },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const enrollments = await prisma.enrollment.findMany({
    where: { classGroupId, status: "ACTIVE" },
    orderBy: { student: { name: "asc" } },
    select: {
      id: true,
      enrolledAt: true,
      status: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
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

  return jsonOk({
    enrollments: enrollments.map((e) => {
      const st = e.student;
      const hasIdDocument = st.attachments.some((a) => a.type === "ID_DOCUMENT");
      const hasAddressProof = st.attachments.some((a) => a.type === "ADDRESS_PROOF");
      const docsMissing = !hasIdDocument || !hasAddressProof;
      const dataComplete = isDataComplete(st);
      const bd = st.birthDate;
      const studentBirthDate =
        bd != null
          ? `${bd.getUTCFullYear()}-${String(bd.getUTCMonth() + 1).padStart(2, "0")}-${String(bd.getUTCDate()).padStart(2, "0")}`
          : null;
      return {
        id: e.id,
        enrolledAt: e.enrolledAt,
        status: e.status,
        studentId: st.id,
        studentName: st.name,
        studentEmail: st.email,
        studentBirthDate,
        documentationAlert: docsMissing ? (dataComplete ? "yellow" : "red") : null,
      };
    }),
  });
}
