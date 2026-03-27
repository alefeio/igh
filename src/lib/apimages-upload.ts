/**
 * Cliente e servidor: upload para a API Apimages (https://apimg.com.br — OpenAPI /v1/upload).
 * Corpo: multipart apenas com o campo `file`. Autenticação: cabeçalho `X-API-Key` (equivalente ao uso da API Key no fluxo Cloudinary, sem expor o segredo de assinatura no cliente).
 *
 * Resposta típica: { url, public_id, format, bytes } (UploadResponse).
 */

export function publicIdFallbackFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+/, "");
    return path.slice(-200) || url.slice(-200);
  } catch {
    return url.slice(-200);
  }
}

/** Cabeçalhos para POST em APIMG_UPLOAD_URL (mesmo papel prático do envio da api_key no Cloudinary). */
export function apimagesUploadHeaders(apiKey: string): HeadersInit {
  return { "X-API-Key": apiKey };
}

/** Corpo multipart conforme OpenAPI Apimages: somente `file`. */
export function buildApimagesUploadFormData(file: File | Blob): FormData {
  const fd = new FormData();
  fd.append("file", file as File);
  return fd;
}

export function parseApimagesUploadJson(json: unknown): {
  url: string | null;
  publicId: string;
  originalFilename?: string;
  bytes?: number;
  errorMessage?: string;
} {
  if (!json || typeof json !== "object") {
    return { url: null, publicId: "" };
  }
  const o = json as Record<string, unknown>;

  // FastAPI 422
  if (Array.isArray(o.detail)) {
    const first = o.detail[0] as { msg?: string } | undefined;
    const msg = typeof first?.msg === "string" ? first.msg : "Erro de validação na API de upload.";
    return { url: null, publicId: "", errorMessage: msg };
  }

  const nestedErr =
    o.error && typeof o.error === "object"
      ? (o.error as Record<string, unknown>).message
      : undefined;
  const errMsg =
    (typeof nestedErr === "string" && nestedErr) ||
    (typeof o.message === "string" ? o.message : undefined) ||
    (typeof o.detail === "string" ? o.detail : undefined);
  if (errMsg) {
    return { url: null, publicId: "", errorMessage: errMsg };
  }

  const secure = typeof o.secure_url === "string" ? o.secure_url : null;
  const directUrl = typeof o.url === "string" ? o.url : null;
  let dataUrl: string | null = null;
  if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    if (typeof d.url === "string") dataUrl = d.url;
    else if (typeof d.secure_url === "string") dataUrl = d.secure_url;
  }
  const finalUrl = secure || directUrl || dataUrl;

  const publicIdRaw =
    (typeof o.public_id === "string" && o.public_id) ||
    (typeof (o as { publicId?: unknown }).publicId === "string" ? (o as { publicId: string }).publicId : "") ||
    "";
  const publicId = publicIdRaw || (finalUrl ? publicIdFallbackFromUrl(finalUrl) : "");

  return {
    url: finalUrl,
    publicId,
    originalFilename: typeof o.original_filename === "string" ? o.original_filename : undefined,
    bytes: typeof o.bytes === "number" ? o.bytes : undefined,
  };
}
