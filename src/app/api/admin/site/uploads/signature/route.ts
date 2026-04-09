import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getApimagesConfig } from "@/lib/apimages";
import { z } from "zod";

const bodySchema = z
  .object({
    kind: z.enum([
      "logo",
      "favicon",
      "qrcode",
      "banners",
      "partners",
      "formations",
      "projects",
      "testimonials",
      "news",
      "transparency",
      "about",
      "inscreva",
      "contato",
      "teachers",
      "onboarding",
      "legal",
    ]),
    id: z.string().uuid().optional(),
  })
  .refine(
    (d) => {
      if (["banners", "projects", "news", "transparency"].includes(d.kind)) return true;
      return !d.id;
    },
    { message: "id só é permitido para banners, projects, news ou transparency." },
  );

/** Devolve URL e chave da API Apimages (fluxo análogo ao “assinado” Cloudinary: cliente envia só o arquivo para APIMG_UPLOAD_URL). */
export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR", "TEACHER"]);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { kind, id } = parsed.data;
  if (user.role === "TEACHER" && kind !== "formations") {
    return jsonErr("FORBIDDEN", "Professores podem enviar apenas imagens de formações (aulas/cursos).", 403);
  }
  if (kind === "onboarding" && user.role !== "MASTER" && user.role !== "ADMIN") {
    return jsonErr("FORBIDDEN", "Apenas Master ou Admin podem enviar imagens do onboarding.", 403);
  }
  if (kind === "legal" && !["MASTER", "ADMIN", "COORDINATOR"].includes(user.role)) {
    return jsonErr("FORBIDDEN", "Apenas equipe autorizada pode enviar imagens dos documentos legais.", 403);
  }
  if (user.role === "TEACHER" && id) {
    return jsonErr("FORBIDDEN", "Uso não permitido.", 403);
  }

  try {
    const { apiKey, uploadUrl } = getApimagesConfig();
    return jsonOk({ uploadUrl, apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
