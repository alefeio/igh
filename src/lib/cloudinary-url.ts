/**
 * Para URLs raw do Cloudinary, adiciona fl_attachment para forçar download e evitar
 * bloqueio de exibição de PDF (conta gratuita ou CORS). Pode ser usado no client.
 * Retorna a URL inalterada se não for Cloudinary raw.
 */
export function cloudinaryRawUrlForDownload(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/raw/upload/")) return url;
  return url.replace(/(\/raw\/upload\/)(v\d+\/)/, "$1fl_attachment/$2");
}
