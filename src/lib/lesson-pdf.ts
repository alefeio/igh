/**
 * Extrai texto puro de contentRich (JSON TipTap ou HTML).
 */
export function contentRichToPlainText(content: string | null | undefined): string {
  const s = (content ?? "").trim();
  if (!s) return "";

  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const doc = JSON.parse(s) as { type?: string; content?: Array<{ type?: string; text?: string; content?: unknown[] }> };
      if (doc?.type === "doc" && Array.isArray(doc.content)) {
        return extractTextFromTipTapContent(doc.content);
      }
    } catch {
      // fallback: trata como HTML
    }
  }

  return htmlToPlainText(s);
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "listItem", "blockquote"]);

function extractTextFromTipTapContent(nodes: Array<{ type?: string; text?: string; content?: unknown[] }>): string {
  const parts: string[] = [];
  for (const node of nodes) {
    const isBlock = node.type && BLOCK_TYPES.has(node.type);
    if (typeof node.text === "string") parts.push(node.text);
    if (Array.isArray(node.content)) {
      parts.push(extractTextFromTipTapContent(node.content as Array<{ type?: string; text?: string; content?: unknown[] }>));
    }
    if (isBlock) parts.push("\n");
  }
  return parts.join("");
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
