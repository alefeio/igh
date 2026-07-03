/** Máximo de fotos por publicação no fórum da aula. */
export const MAX_FORUM_QUESTION_IMAGES = 10;

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

/** Aceita apenas URLs https de imagem já enviadas ao storage. */
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

/** Anexa imagens do fórum ao HTML da publicação (usado em respostas de professor sem coluna imageUrls). */
export function mergeForumImagesIntoHtml(content: string, imageUrls: string[]): string {
  const imgs =
    imageUrls.length > 0
      ? imageUrls.map((url) => `<p><img src="${url}" alt="" /></p>`).join("")
      : "";
  const trimmed = (content || "").trim();
  if (!trimmed && !imgs) return "";
  if (!imgs) return trimmed;
  if (!trimmed) return imgs;
  return `${trimmed}${imgs}`;
}
