/**
 * Detecta se uma URL aponta para vídeo (por extensão).
 * Usado no carrossel e na pré-visualização do admin.
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const clean = url.trim().split("?")[0].split("#")[0].toLowerCase();
  return /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv)$/i.test(clean);
}
