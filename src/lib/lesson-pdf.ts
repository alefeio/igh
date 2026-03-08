/** Bloco formatado para renderização no PDF (preserva estrutura do HTML/ TipTap). */
export type PdfBlock =
  | { type: "heading1"; text: string }
  | { type: "heading2"; text: string }
  | { type: "heading3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string; level: number }
  | { type: "ordered"; text: string; level: number; number: number }
  | { type: "blockquote"; text: string }
  | { type: "code"; text: string };

/**
 * Converte contentRich (JSON TipTap ou HTML) em blocos para desenhar no PDF com formatação.
 */
export function contentRichToPdfBlocks(content: string | null | undefined): PdfBlock[] {
  const s = (content ?? "").trim();
  if (!s) return [];

  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const doc = JSON.parse(s) as { type?: string; content?: TipTapNode[] };
      if (doc?.type === "doc" && Array.isArray(doc.content)) {
        return tipTapContentToPdfBlocks(doc.content);
      }
    } catch {
      // fallback: trata como HTML
    }
  }

  return htmlToPdfBlocks(s);
}

type TipTapNode = {
  type?: string;
  attrs?: { level?: number };
  content?: TipTapNode[];
  text?: string;
};

function getTextFromNodes(nodes: TipTapNode[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (typeof node.text === "string") parts.push(node.text);
    if (Array.isArray(node.content)) parts.push(getTextFromNodes(node.content));
  }
  return parts.join("");
}

function tipTapContentToPdfBlocks(nodes: TipTapNode[]): PdfBlock[] {
  const blocks: PdfBlock[] = [];

  function walk(list: TipTapNode[], orderedIndex: { value: number }, listLevel: number, listKind: "bullet" | "ordered" | null) {
    for (const node of list) {
      const type = node.type ?? "";

      if (type === "heading") {
        const text = getTextFromNodes(node.content ?? []).trim();
        if (!text) continue;
        const level = node.attrs?.level ?? 1;
        if (level === 1) blocks.push({ type: "heading1", text });
        else if (level === 2) blocks.push({ type: "heading2", text });
        else blocks.push({ type: "heading3", text });
        continue;
      }

      if (type === "paragraph") {
        const text = getTextFromNodes(node.content ?? []).trim();
        if (listKind) {
          if (listKind === "bullet") blocks.push({ type: "bullet", text, level: listLevel });
          else blocks.push({ type: "ordered", text, level: listLevel, number: orderedIndex.value });
        } else {
          blocks.push({ type: "paragraph", text: text || " " });
        }
        if (listKind === "ordered") orderedIndex.value++;
        continue;
      }

      if (type === "bulletList") {
        const items = node.content ?? [];
        for (const item of items) {
          if (item.type === "listItem") walk(item.content ?? [], orderedIndex, 0, "bullet");
        }
        continue;
      }

      if (type === "orderedList") {
        const items = node.content ?? [];
        const listCounter = { value: 1 };
        for (const item of items) {
          if (item.type === "listItem") walk(item.content ?? [], listCounter, 0, "ordered");
        }
        continue;
      }

      if (type === "listItem") {
        walk(node.content ?? [], orderedIndex, listLevel, listKind);
        continue;
      }

      if (type === "blockquote") {
        const text = getTextFromNodes(node.content ?? []).trim();
        if (text) blocks.push({ type: "blockquote", text });
        continue;
      }

      if (type === "codeBlock") {
        const text = getTextFromNodes(node.content ?? []).trimEnd();
        blocks.push({ type: "code", text: text || " " });
        continue;
      }

      if (Array.isArray(node.content)) walk(node.content, orderedIndex, listLevel, listKind);
    }
  }

  walk(nodes, { value: 1 }, 0, null);
  return blocks;
}

/** Extrai blocos de HTML (h1–h3, p, ul/ol/li, blockquote, pre). */
function htmlToPdfBlocks(html: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const decoded = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const reBlock = /<(h[1-3]|p|li|blockquote|pre)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  const reUl = /<ul[\s\S]*?<\/ul>/gi;
  const reOl = /<ol[\s\S]*?<\/ol>/gi;

  let match: RegExpExecArray | null;
  const preParts: string[] = [];
  let rest = decoded;
  const pres = decoded.match(/<pre[\s\S]*?<\/pre>/gi);
  if (pres) {
    for (const pre of pres) {
      const inner = pre.replace(/<\/?pre[^>]*>/gi, "").replace(/<code[^>]*>|<\/code>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
      preParts.push(inner);
    }
    rest = decoded.replace(/<pre[\s\S]*?<\/pre>/gi, "\u0000");
  }

  let preIdx = 0;
  const listStack: { kind: "bullet" | "ordered"; count: number }[] = [];

  while ((match = reBlock.exec(decoded)) !== null) {
    const tag = match[1].toLowerCase();
    const raw = match[2];
    const text = stripTags(raw).trim();

    if (tag === "pre") {
      const codeText = preParts[preIdx++] ?? text;
      blocks.push({ type: "code", text: codeText ? codeText : " " });
      continue;
    }
    if (tag === "h1") {
      blocks.push({ type: "heading1", text });
      continue;
    }
    if (tag === "h2") {
      blocks.push({ type: "heading2", text });
      continue;
    }
    if (tag === "h3") {
      blocks.push({ type: "heading3", text });
      continue;
    }
    if (tag === "blockquote") {
      blocks.push({ type: "blockquote", text });
      continue;
    }
    if (tag === "li") {
      const inOl = decoded.slice(0, match.index).replace(/<ol[\s\S]*?<\/ol>/g, "").lastIndexOf("<ol") > decoded.slice(0, match.index).lastIndexOf("<ul");
      const olMatch = decoded.slice(0, match.index).match(/<ol/gi);
      const num = olMatch ? olMatch.length : 0;
      if (inOl && num > 0) blocks.push({ type: "ordered", text, level: 0, number: num });
      else blocks.push({ type: "bullet", text, level: 0 });
      continue;
    }
    if (tag === "p") {
      if (!/<(ul|ol|li|h[1-3]|blockquote|pre)/i.test(raw)) blocks.push({ type: "paragraph", text: text || " " });
    }
  }

  if (preParts.length > 0 && blocks.filter((b) => b.type === "code").length === 0) {
    for (const p of preParts) blocks.push({ type: "code", text: p || " " });
  }

  if (blocks.length === 0) {
    const plain = stripTags(decoded);
    if (plain) blocks.push({ type: "paragraph", text: plain });
  }

  return blocks;
}

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
