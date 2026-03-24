import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { publicTestimonialSchema } from "@/lib/validators/site";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = publicTestimonialSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const { name, roleOrContext, quote, photoUrl } = parsed.data;

  await prisma.pendingTestimonial.create({
    data: {
      name: name.trim(),
      roleOrContext: roleOrContext?.trim() ? roleOrContext.trim() : null,
      quote: quote.trim(),
      photoUrl: photoUrl?.trim() ? photoUrl.trim() : null,
      status: "pending",
    },
  });

  return jsonOk(
    { message: "Depoimento recebido. Será publicado após aprovação." },
    { status: 201 }
  );
}
