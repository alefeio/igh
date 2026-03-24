import { generateUploadSignature, getCloudinaryConfig, getSiteUploadFolder } from "@/lib/cloudinary";
import { jsonErr, jsonOk } from "@/lib/http";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonErr("INVALID_BODY", "Corpo da requisição inválido.", 400);
  }

  const file = formData.get("photo");
  if (!file || !(file instanceof File)) {
    return jsonErr("VALIDATION_ERROR", "Envie um arquivo de imagem no campo photo.", 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonErr("VALIDATION_ERROR", "Imagem muito grande. Máximo 5MB.", 400);
  }

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(mime)) {
    return jsonErr("VALIDATION_ERROR", "Use JPEG, PNG ou WebP.", 400);
  }

  try {
    const folder = getSiteUploadFolder("testimonials");
    const { signature, timestamp } = generateUploadSignature({ folder });
    const { apiKey, cloudName } = getCloudinaryConfig();

    const uploadFd = new FormData();
    uploadFd.append("file", file);
    uploadFd.append("api_key", apiKey);
    uploadFd.append("timestamp", String(timestamp));
    uploadFd.append("signature", signature);
    uploadFd.append("folder", folder);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadFd,
    });

    const uploadJson = (await uploadRes.json()) as {
      secure_url?: string;
      error?: { message?: string };
    };

    if (!uploadRes.ok || uploadJson.error) {
      return jsonErr(
        "UPLOAD_FAILED",
        uploadJson.error?.message ?? "Falha ao enviar imagem. Tente novamente.",
        502
      );
    }

    const url = uploadJson.secure_url;
    if (!url) {
      return jsonErr("UPLOAD_FAILED", "Resposta do serviço de imagem inválida.", 502);
    }

    return jsonOk({ url }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao processar upload.";
    if (message.includes("CLOUDINARY")) {
      return jsonErr("CONFIG_ERROR", "Upload de imagens não configurado no servidor.", 503);
    }
    return jsonErr("SERVER_ERROR", message, 500);
  }
}
