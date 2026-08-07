import "server-only";

import { getApimagesConfig } from "@/lib/apimages";
import {
  apimagesUploadHeaders,
  parseApimagesUploadJson,
  publicIdFallbackFromUrl,
} from "@/lib/apimages-upload";

/** Envia um PDF gerado no servidor para a Apimages. */
export async function uploadGerenciaPdfBytes(
  bytes: Uint8Array,
  fileName: string,
): Promise<{ url: string; publicId: string }> {
  const { uploadUrl, apiKey } = getApimagesConfig();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  form.append("file", blob, fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: apimagesUploadHeaders(apiKey),
    body: form,
  });
  const json = await res.json().catch(() => null);
  const parsed = parseApimagesUploadJson(json);
  if (!res.ok || !parsed.url) {
    throw new Error(parsed.errorMessage || "Falha ao enviar PDF para o armazenamento.");
  }
  return {
    url: parsed.url,
    publicId: parsed.publicId || publicIdFallbackFromUrl(parsed.url),
  };
}
