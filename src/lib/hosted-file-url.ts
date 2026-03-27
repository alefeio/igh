/**
 * Para URLs raw do Cloudinary (dados antigos), adiciona fl_attachment para forçar download.
 * Demais URLs (ex.: Apimages) retornam sem alteração.
 */
export function hostedRawUrlForDownload(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/raw/upload/")) return url;
  return url.replace(/(\/raw\/upload\/)(v\d+\/)/, "$1fl_attachment/$2");
}

/** @deprecated use hostedRawUrlForDownload */
export const cloudinaryRawUrlForDownload = hostedRawUrlForDownload;
