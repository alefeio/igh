import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { contactMessageSchema } from "@/lib/validators/site";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = contactMessageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const { name, email, phone, message } = parsed.data;

  await prisma.contactMessage.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      message: message.trim(),
    },
  });

  return jsonOk(
    { message: "Mensagem enviada com sucesso. Em breve entraremos em contato." },
    { status: 201 }
  );
}
