/**
 * Cliente e servidor: parse da resposta de upload (compatível com formato estilo Cloudinary: secure_url, public_id, etc.).
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

  const nestedErr =
    o.error && typeof o.error === "object"
      ? (o.error as Record<string, unknown>).message
      : undefined;
  const errMsg =
    (typeof nestedErr === "string" && nestedErr) ||
    (typeof o.message === "string" ? o.message : undefined);
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

export function buildApimagesFormData(
  file: File | Blob,
  fields: { apiKey: string; folder: string; use_filename?: boolean },
  opts?: { resourceType?: "image" | "raw" | "auto" },
): FormData {
  const fd = new FormData();
  fd.append("file", file as File);
  fd.append("api_key", fields.apiKey);
  fd.append("folder", fields.folder);
  if (fields.use_filename) fd.append("use_filename", "true");
  const rt = opts?.resourceType;
  if (rt && rt !== "auto") fd.append("resource_type", rt);
  return fd;
}
