import { getCloudinaryConfig, generateUploadSignature, getSiteUploadFolder } from "@/lib/cloudinary";
import { jsonErr, jsonOk } from "@/lib/http";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("photo");
    if (!file || !(file instanceof File)) {
      return jsonErr("VALIDATION_ERROR", "Envie uma foto (campo 'photo').", 400);
    }
    if (file.size > MAX_SIZE) {
      return jsonErr("VALIDATION_ERROR", "A foto deve ter no máximo 5MB.", 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonErr("VALIDATION_ERROR", "Formato inválido. Use JPEG, PNG ou WebP.", 400);
    }

    const folder = getSiteUploadFolder("testimonials");
    const { signature, timestamp } = generateUploadSignature({ folder });
    const { cloudName, apiKey } = getCloudinaryConfig();

    const body = new FormData();
    body.append("file", new Blob([await file.arrayBuffer()], { type: file.type }), file.name || "photo");
    body.append("api_key", apiKey);
    body.append("timestamp", String(timestamp));
    body.append("signature", signature);
    body.append("folder", folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || data.error) {
      return jsonErr("UPLOAD_ERROR", data.error?.message ?? "Falha no upload da foto.", 400);
    }
    if (!data.secure_url) {
      return jsonErr("UPLOAD_ERROR", "Resposta inválida do servidor de imagens.", 500);
    }
    return jsonOk({ url: data.secure_url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar foto.";
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}
