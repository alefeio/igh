export type ParsedMultipleChoice = {
  question: string;
  options: string[];
};

const OPTION_LINE_RE =
  /^\s*(?:\*\*)?\s*(?:\(([A-Ha-h1-9])\)|([A-Ha-h1-9])(?:\)|\.|:|\s+-\s+))\s*(?:\*\*)?\s*(.*?)\s*$/;

function normalizeNewlines(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function optionTextFromLine(line: string): string | null {
  const match = OPTION_LINE_RE.exec(line);
  if (!match) return null;
  return (match[3] ?? "").trim();
}

function isOptionLine(line: string): boolean {
  return OPTION_LINE_RE.test(line);
}

function parseWithPrefixes(text: string): ParsedMultipleChoice | null {
  const lines = text.split("\n");
  const firstOptionIndex = lines.findIndex((line) => isOptionLine(line));
  if (firstOptionIndex < 0) return null;

  const question = lines.slice(0, firstOptionIndex).join("\n").trim();
  if (!question) return null;

  const options: string[] = [];
  for (let i = firstOptionIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const prefixed = optionTextFromLine(line);
    if (prefixed !== null) {
      options.push(prefixed);
    } else if (options.length > 0) {
      options[options.length - 1] = `${options[options.length - 1]} ${line.trim()}`;
    }
  }

  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  if (trimmedOptions.length < 2) return null;

  return { question, options: trimmedOptions };
}

function parseFallback(text: string): ParsedMultipleChoice | null {
  if (!/\n\s*\n/.test(text)) return null;

  const nonEmpty = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (nonEmpty.length < 3) return null;
  if (isOptionLine(nonEmpty[0])) return null;

  const [question, ...options] = nonEmpty;
  if (!question || options.length < 2) return null;

  return { question, options };
}

export function parsePastedMultipleChoice(raw: string): ParsedMultipleChoice | null {
  const text = normalizeNewlines(raw);
  return parseWithPrefixes(text) ?? parseFallback(text);
}
