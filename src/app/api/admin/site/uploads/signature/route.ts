import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getApimagesConfig, getSiteUploadFolder, getSiteUploadFolderWithId } from "@/lib/apimages";
import { z } from "zod";

const bodySchema = z
  .object({
    kind: z.enum([
      "logo",
      "favicon",
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
  if (user.role === "TEACHER" && id) {
    return jsonErr("FORBIDDEN", "Uso não permitido.", 403);
  }
  let folder: string;
  if (id && ["banners", "projects", "news", "transparency"].includes(kind)) {
    folder = getSiteUploadFolderWithId(kind as "banners" | "projects" | "news" | "transparency", id);
  } else {
    folder = getSiteUploadFolder(kind);
  }

  try {
    const { apiKey, uploadUrl } = getApimagesConfig();
    const isTransparency = kind === "transparency";
    return jsonOk({
      uploadUrl,
      apiKey,
      folder,
      ...(isTransparency && { use_filename: true }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao preparar upload.";
    return jsonErr("CONFIG_ERROR", message, 500);
  }
}
