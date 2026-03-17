import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { formatDateOnly } from "@/lib/format";
import { consumeVerificationToken, findTokenByRaw } from "@/lib/verification-token";
import { createAuditLog } from "@/lib/audit";
import { TERMS_VERSION } from "@/lib/email/templates";

const confirmSchema = { token: (v: unknown) => typeof v === "string" && v.length > 0, termsAccepted: (v: unknown) => v === true };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token?.trim()) {
    return jsonErr("VALIDATION_ERROR", "Token ausente.", 400);
  }

  const tokenPayload = await findTokenByRaw({
    rawToken: token,
    type: "ENROLLMENT_CONFIRMATION",
  });

  if (!tokenPayload.valid || !tokenPayload.enrollmentId) {
    return jsonErr("INVALID_TOKEN", "Link inválido ou expirado.", 400);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: tokenPayload.enrollmentId },
    include: {
      student: { select: { name: true } },
      classGroup: {
        include: {
          course: { select: { name: true } },
        },
      },
    },
  });

  if (!enrollment || enrollment.enrollmentConfirmedAt) {
    return jsonErr("INVALID_TOKEN", "Link inválido ou já utilizado.", 400);
  }

  const startDate = formatDateOnly(enrollment.classGroup.startDate);
  const days = Array.isArray(enrollment.classGroup.daysOfWeek)
    ? enrollment.classGroup.daysOfWeek.join(", ")
    : String(enrollment.classGroup.daysOfWeek);

  return jsonOk({
    studentName: enrollment.student.name,
    courseName: enrollment.classGroup.course.name,
    startDate,
    daysOfWeek: days,
    startTime: enrollment.classGroup.startTime,
    endTime: enrollment.classGroup.endTime,
    location: enrollment.classGroup.location,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const termsAccepted = body?.termsAccepted === true;

  if (!confirmSchema.token(token)) {
    return jsonErr("VALIDATION_ERROR", "Token inválido ou ausente.", 400);
  }
  if (!termsAccepted) {
    return jsonErr("VALIDATION_ERROR", "É necessário aceitar os termos de uso.", 400);
  }

  const payload = await consumeVerificationToken({
    rawToken: token,
    type: "ENROLLMENT_CONFIRMATION",
  });

  if (!payload || !payload.enrollmentId) {
    return jsonErr("INVALID_TOKEN", "Link inválido ou expirado. Solicite um novo e-mail de confirmação.", 400);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: payload.enrollmentId },
    include: { student: true },
  });

  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }
  if (enrollment.enrollmentConfirmedAt) {
    return jsonOk({ message: "Inscrição já estava confirmada.", alreadyConfirmed: true });
  }

  const now = new Date();
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;

  await prisma.enrollment.update({
    where: { id: payload.enrollmentId },
    data: {
      enrollmentConfirmedAt: now,
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
      confirmationMethod: "EMAIL_LINK",
      confirmedIp: ip,
    },
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: payload.enrollmentId,
    action: "ENROLLMENT_CONFIRMED",
    diff: {
      enrollmentId: payload.enrollmentId,
      studentId: payload.studentId,
      termsVersion: TERMS_VERSION,
      confirmedAt: now.toISOString(),
    },
    performedByUserId: payload.userId,
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: payload.enrollmentId,
    action: "TERMS_ACCEPTED",
    diff: { termsVersion: TERMS_VERSION, acceptedAt: now.toISOString() },
    performedByUserId: payload.userId,
  });

  return jsonOk({
    message: "Inscrição confirmada com sucesso.",
    redirectTo: "/login?confirmed=1",
  });
}
