/** Máximo de anexos (fotos ou documentos) por publicação no fórum da aula. */
export const MAX_FORUM_QUESTION_IMAGES = 10;

/** Tamanho máximo por arquivo no fórum (25 MB). */
export const MAX_FORUM_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Tipos e extensões aceitos no input de anexo do fórum. */
export const FORUM_ATTACHMENT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.ods,.odp,.txt,.rtf,.csv,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FORUM_BLOCKED_ATTACHMENT_EXT = /\.(exe|bat|cmd|com|msi|scr|js|vbs|ps1|sh|dll)$/i;

/** Remove marcação HTML e normaliza espaços para validar texto rico vazio. */
export function stripRichTextToPlain(html: string): string {
  const s = (html || "").trim();
  if (!s) return "";
  if (s.startsWith("{") && s.includes('"type":"doc"')) {
    try {
      const doc = JSON.parse(s) as { content?: Array<{ content?: Array<{ text?: string }> }> };
      const texts: string[] = [];
      for (const block of doc.content ?? []) {
        for (const inline of block.content ?? []) {
          if (typeof inline.text === "string" && inline.text.trim()) texts.push(inline.text.trim());
        }
      }
      return texts.join(" ").trim();
    } catch {
      // segue com strip HTML
    }
  }
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isForumPostEmpty(content: string, imageUrls: string[]): boolean {
  return stripRichTextToPlain(content).length === 0 && imageUrls.length === 0;
}

/** Aceita apenas URLs https de anexos já enviados ao storage. */
export function parseForumImageUrls(raw: unknown, max = MAX_FORUM_QUESTION_IMAGES): string[] {
  if (!Array.isArray(raw)) return [];
  const urls: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const u = item.trim();
    if (!u.startsWith("https://")) continue;
    if (urls.includes(u)) continue;
    urls.push(u);
    if (urls.length >= max) break;
  }
  return urls;
}

export function contentLooksLikeHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content.trim());
}

/** Heurística para decidir se a URL deve ser exibida como imagem ou como arquivo. */
export function isProbablyImageUrl(url: string): boolean {
  const u = (url || "").trim().toLowerCase();
  if (!u) return false;
  if (u.includes("/image/upload/")) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(u);
}

export function forumAttachmentFileName(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return "arquivo";
}

export function isAllowedForumAttachmentFile(file: File): { ok: true } | { ok: false; message: string } {
  if (!file || file.size <= 0) return { ok: false, message: "Arquivo inválido." };
  if (file.size > MAX_FORUM_ATTACHMENT_BYTES) {
    return { ok: false, message: "Cada arquivo pode ter no máximo 25 MB." };
  }
  if (FORUM_BLOCKED_ATTACHMENT_EXT.test(file.name)) {
    return { ok: false, message: "Este tipo de arquivo não é permitido." };
  }
  return { ok: true };
}

/** Anexa mídia do fórum ao HTML da publicação (usado em respostas de professor sem coluna imageUrls). */
export function mergeForumImagesIntoHtml(content: string, imageUrls: string[]): string {
  const embeds =
    imageUrls.length > 0
      ? imageUrls
          .map((url) => {
            if (isProbablyImageUrl(url)) return `<p><img src="${url}" alt="" /></p>`;
            const name = forumAttachmentFileName(url).replace(/"/g, "&quot;");
            return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></p>`;
          })
          .join("")
      : "";
  const trimmed = (content || "").trim();
  if (!trimmed && !embeds) return "";
  if (!embeds) return trimmed;
  if (!trimmed) return embeds;
  return `${trimmed}${embeds}`;
}
