import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { acceptWaitlistSeatOffer } from "@/lib/waitlist-alternate-seat";
import { sendEnrollmentWelcomeForStudent } from "@/lib/enrollment-welcome-email";

/**
 * Link do e-mail “Quero esta vaga”: matricula o aluno na turma oferecida.
 * O e-mail de boas-vindas traz o link de confirmação dos termos.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    redirect("/inscreva?offer=invalid");
  }

  const result = await acceptWaitlistSeatOffer(token);
  if (!result.ok) {
    redirect(`/inscreva?offer=${encodeURIComponent(result.code)}`);
  }

  try {
    await sendEnrollmentWelcomeForStudent({
      studentId: result.studentId,
      enrollmentId: result.enrollmentId,
      emailType: "welcome_student_waitlist",
      auditExtra: { fromWaitlistSeatOffer: true },
    });
  } catch (e) {
    console.error("[aceitar-vaga] falha ao enviar boas-vindas", result.enrollmentId, e);
  }

  redirect(
    `/inscreva?offer=accepted&course=${encodeURIComponent(result.courseName)}`
  );
}
