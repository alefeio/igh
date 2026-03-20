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
