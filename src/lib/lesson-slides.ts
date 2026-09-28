const HTML_NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Texto visível de um fragmento HTML, sem tags. */
export function htmlFragmentToPlainText(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, entity: string) => {
      const token = entity.toLowerCase();
      if (token.startsWith("#x")) {
        const code = Number.parseInt(token.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : full;
      }
      if (token.startsWith("#")) {
        const code = Number.parseInt(token.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : full;
      }
      return HTML_NAMED_ENTITIES[token] ?? full;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Título do primeiro H1 do trecho, ou null se o slide não começa com título. */
export function h1TitleFromHtml(html: string): string | null {
  const match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!match) return null;
  const title = htmlFragmentToPlainText(match[1] ?? "");
  return title || null;
}

export type SlideTitleEntry = { pageIndex: number; title: string };

/** Índice dos slides que têm H1, na ordem das páginas geradas por splitContentByH1. */
export function slideTitleIndex(sections: { html: string }[]): SlideTitleEntry[] {
  const entries: SlideTitleEntry[] = [];
  sections.forEach((section, pageIndex) => {
    const title = h1TitleFromHtml(section.html);
    if (title) entries.push({ pageIndex, title });
  });
  return entries;
}

/** Divide o HTML do conteúdo em páginas separadas por cada título H1. */
export function splitContentByH1(html: string): { html: string; startOffset: number }[] {
  const trimmed = (html || "").trim();
  if (!trimmed) return [];
  const regex = /<h1(?:\s[^>]*)?>/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(trimmed)) !== null) indices.push(m.index);
  if (indices.length === 0) return [{ html: trimmed, startOffset: 0 }];
  const sections: { html: string; startOffset: number }[] = [];
  if (indices[0]! > 0) sections.push({ html: trimmed.slice(0, indices[0]!), startOffset: 0 });
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]!;
    const end = indices[i + 1] ?? trimmed.length;
    sections.push({ html: trimmed.slice(start, end), startOffset: start });
  }
  return sections;
}
