import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPublicWaitlistSchema } from "@/lib/validators/waitlist";
import { verifyStudentToken } from "@/lib/student-token";
import { assertCanJoinWaitlist, createWaitlistEntry } from "@/lib/enrollment-waitlist-create";
import { createAuditLog } from "@/lib/audit";

/** Reserva pública: aluno já cadastrado (sessão STUDENT ou studentToken). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createPublicWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { classGroupId, studentToken } = parsed.data;
  let studentId: string | null = null;

  const session = await getSessionUserFromCookie();
  if (session?.role === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId: session.id, deletedAt: null },
      select: { id: true },
    });
    if (student) studentId = student.id;
  }

  if (!studentId && studentToken) {
    const payload = await verifyStudentToken(studentToken);
    if (payload) studentId = payload.studentId;
  }

  if (!studentId) {
    return jsonErr(
      "UNAUTHORIZED",
      "Faça o cadastro de aluno antes de entrar na lista de espera.",
      401,
    );
  }

  const check = await assertCanJoinWaitlist({ studentId, classGroupId, publicOnly: true });
  if (!check.ok) {
    return jsonErr(check.code, check.message, check.status);
  }

  const entry = await createWaitlistEntry({ studentId, classGroupId });

  await createAuditLog({
    entityType: "EnrollmentWaitlist",
    entityId: entry.id,
    action: "CREATE",
    diff: { studentId, classGroupId, source: "public" },
  });

  const position = await prisma.enrollmentWaitlist.count({
    where: {
      classGroupId,
      status: "WAITING",
      createdAt: { lte: entry.createdAt },
    },
  });

  return jsonOk(
    {
      waitlist: {
        id: entry.id,
        classGroupId: entry.classGroupId,
        status: entry.status,
        position,
        courseName: entry.classGroup.course.name,
        createdAt: entry.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
