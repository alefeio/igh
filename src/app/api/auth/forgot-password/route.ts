import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification-token";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/email";
import { templatePasswordReset } from "@/lib/email/templates";
import { jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Informe o e-mail." } },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (user) {
    const { token } = await createVerificationToken({
      userId: user.id,
      type: "PASSWORD_RESET",
      expiresInDays: 1,
    });
    const resetUrl = getAppUrl(`/redefinir-senha?token=${encodeURIComponent(token)}`);
    const { subject, html } = templatePasswordReset({ name: user.name, resetUrl });
    await sendEmail({ to: email, subject, html });
  }

  return jsonOk({ message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha." });
}
