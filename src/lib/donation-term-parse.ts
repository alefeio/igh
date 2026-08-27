/**
 * Extração heurística de campos de termos de doação IGH/INAC a partir de texto de PDF.
 * Projetado para PDFs digitais gerados pelo sistema; escaneados dependem de OCR/visão.
 */

export type DonationTermSuggestion = {
  donorName?: string;
  donorDocument?: string;
  donorCity?: string;
  donorState?: string;
  donorCep?: string;
  donorAddress?: string;
  donorPhone?: string;
  donorEmail?: string;
  donorRepresentativeName?: string;
  donorRepresentativeRole?: string;
  donorRepresentativeCpf?: string;
  donatariaName?: string;
  donatariaDocument?: string;
  donatariaContactName?: string;
  donatariaPhone?: string;
  donatariaEmail?: string;
  donatariaStreet?: string;
  donatariaCity?: string;
  donatariaState?: string;
  donatariaCep?: string;
  donatariaZone?: "URBANA" | "RURAL";
  donatedAt?: string;
  placeDateText?: string;
  kitsCount?: number;
  belongsTo?: string;
  description?: string;
  /** Modelo inferido do texto (IGH vs INAC). */
  templateKind?: "IGH" | "INAC";
};

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** Normaliza ruído típico de OCR em termos escaneados. */
export function normalizeDonationTermOcrText(raw: string): string {
  return raw
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    // e-mail: guilherme(&igh.org.br / guilherme&igh.org.br → @
    .replace(/([A-Za-z0-9._%+-])\(&/g, "$1@")
    .replace(/([A-Za-z0-9._%+-])\(@/g, "$1@")
    .replace(/([A-Za-z0-9._%+-])&(?=[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1@")
    // CNPJ com vírgula no lugar do ponto: 08,633,366 → 08.633.366
    .replace(/(\d),(\d{3})/g, "$1.$2")
    .replace(/DONAT[ÁA]RIA\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]?\s*(?=\n)/gi, "DONATÁRIA\n")
    .replace(/DOADORA\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]?\s*(?=\n|:)/gi, "DOADORA\n");
}

function cleanValue(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let v = raw
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[:\-–—|.\s]+/, "")
    .trim();
  // Corta lixo de OCR após "| …" (ex.: "NOME | i", "Chaves |U EA")
  const pipeIdx = v.search(/\s*[|]\s*/);
  if (pipeIdx >= 3) {
    const after = v.slice(pipeIdx).replace(/^[|\s]+/, "").trim();
    if (after.length <= 12 || !/[a-zà-ú]{4,}/i.test(after.split(/\s+/)[0] ?? "")) {
      v = v.slice(0, pipeIdx).trim();
    }
  }
  v = v
    .replace(/^;\s*/, "")
    .replace(/\s+[Íí]\s*$/u, "")
    .replace(/\s*[—–\-|:.]+\s*$/u, "")
    .replace(/\s+[a-zA-ZÁÉÍÓÚáéíóú]\s*$/u, "")
    .trim();
  // sobras tipo "NOME — ]" ou "NOME ]"
  v = v.replace(/\s*[\]\[]+\s*$/u, "").replace(/\s*[—–]\s*[\]\[]?\s*$/u, "").trim();
  if (!v || /^[\-–—_]+$/.test(v) || v.length === 1) return undefined;
  return v.slice(0, 240);
}

function onlyDigits(v: string | undefined): string | undefined {
  if (!v) return undefined;
  let d = v.replace(/\D/g, "");
  // OCR costuma dobrar zero no ramo: …/00001-04 (15 dígitos) → …/0001-04
  if (d.length === 15 && d.slice(8, 13) === "00001") {
    d = `${d.slice(0, 8)}0001${d.slice(13)}`;
  }
  if (d.length === 14 || d.length === 11) return d;
  return d.length >= 11 && d.length <= 14 ? d : undefined;
}

function formatCnpjLike(digits: string): string {
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return digits;
}

/** Captura valor após um rótulo até o próximo rótulo conhecido ou quebra de linha. */
function afterLabel(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:.]?\\s*([^\\n\\r]+)`,
      "i",
    );
    const m = text.match(re);
    let v = cleanValue(m?.[1]);
    if (!v) continue;
    // Mesma linha com outro campo: "TEL: … Email: …" / "CEP: … Zona: …"
    v = cleanValue(
      v.replace(
        /\s+(Email|E-mail|TEL|Telefone|Fone|CNPJ|CEP|Zona|Estado|UF|Cidade|Cargo|CPF|Respons[aá]vel|Institui[cç][aã]o)\s*[:.].*$/i,
        "",
      ),
    );
    if (v) return v;
  }
  return undefined;
}

function sectionBetween(text: string, start: RegExp, end: RegExp): string {
  const s = text.search(start);
  if (s < 0) return "";
  const rest = text.slice(s);
  const e = rest.search(end);
  return e > 0 ? rest.slice(0, e) : rest;
}

function parsePlaceDate(text: string): { placeDateText?: string; donatedAt?: string } {
  // Belém, 26 de agosto de 2026
  const m = text.match(
    /([A-Za-zÀ-ÿ\s]+),\s*(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})/i,
  );
  if (!m) {
    const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return { donatedAt: `${iso[1]}-${iso[2]}-${iso[3]}` };
    const br = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (br) return { donatedAt: `${br[3]}-${br[2]}-${br[1]}` };
    return {};
  }
  const city = cleanValue(m[1]);
  const day = Number(m[2]);
  const monthKey = m[3].toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const month =
    MONTHS[m[3].toLowerCase()] ??
    MONTHS[monthKey] ??
    MONTHS[`${monthKey.replace("c", "ç")}`];
  const year = Number(m[4]);
  const placeDateText = cleanValue(m[0]);
  if (!month || !day || !year) return { placeDateText };
  const donatedAt = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { placeDateText, donatedAt: city ? donatedAt : donatedAt };
}

function parseZone(text: string): "URBANA" | "RURAL" | undefined {
  if (/\(X\)\s*Rural/i.test(text) || /Zona:\s*.*Rural.*\(X\)/i.test(text)) return "RURAL";
  if (/\(X\)\s*Urbana/i.test(text) || /Zona:\s*.*Urbana.*\(X\)/i.test(text)) return "URBANA";
  if (/\bRural\b/i.test(text) && !/\bUrbana\b/i.test(text)) return "RURAL";
  if (/\bUrbana\b/i.test(text)) return "URBANA";
  return undefined;
}

function parseDonatariaName(doneeSec: string, fullText: string): string | undefined {
  const block = doneeSec || fullText;
  const inst = block.match(/Institui[cç][aã]o\s*[:.]?\s*([\s\S]*?)(?=\n\s*CNPJ\s*[:.]?)/i);
  if (inst?.[1]) {
    const merged = inst[1]
      .replace(/\n+/g, " ")
      .replace(/\s*\|\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const v = cleanValue(merged);
    if (v && v.length >= 3) return v;
  }
  return (
    afterLabel(block, ["Instituição", "Instituicao", "Nome"]) ??
    afterLabel(fullText, ["Donatária", "Donataria"])
  );
}

function parseKitsCount(text: string): number | undefined {
  const obj = sectionBetween(text, /OBJETO/i, /OBS:|ACORDO|São obrigações/i) || text;

  // Linhas do tipo "Monitor 10", "CPU | 2", "Teclado | 10"
  const kitSignals: Array<{ name: string; qty: number }> = [];
  for (const rawLine of obj.split(/\n+/)) {
    const line = rawLine.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
    if (!line || line.length < 3) continue;
    const m =
      line.match(
        /\b(CPU|Computador(?:es)?|Monitor(?:es)?|Teclado(?:s)?|Mouse(?:s)?|Cabo\s+de\s+For[cç]a|Cabo\s+de\s+V[ií]deo)\b[^\d]{0,40}?(\d{1,3})\b/i,
      ) ??
      line.match(
        /\b(\d{1,3})\b[^\n]{0,20}\b(CPU|Computador(?:es)?|Monitor(?:es)?|Teclado(?:s)?|Mouse(?:s)?)\b/i,
      );
    if (!m) continue;
    const a = m[1];
    const b = m[2];
    const name = /^\d+$/.test(a) ? b : a;
    const qty = Number(/^\d+$/.test(a) ? a : b);
    if (!Number.isFinite(qty) || qty <= 0 || qty >= 500) continue;
    kitSignals.push({ name, qty });
  }

  // Kit padrão: 1 CPU/Monitor/Teclado/Mouse por kit. Cabo de Força = 2/kit.
  const perKit: number[] = [];
  for (const s of kitSignals) {
    if (/cabo\s+de\s+for/i.test(s.name)) {
      if (s.qty % 2 === 0 && s.qty / 2 >= 1) perKit.push(s.qty / 2);
      continue;
    }
    if (/cpu|computador|monitor|teclado|mouse|cabo\s+de\s+v/i.test(s.name)) {
      perKit.push(s.qty);
    }
  }
  if (perKit.length > 0) {
    const freq = new Map<number, number>();
    for (const n of perKit) freq.set(n, (freq.get(n) ?? 0) + 1);
    let best = perKit[0];
    let bestCount = 0;
    for (const [n, c] of freq) {
      if (c > bestCount || (c === bestCount && n > best)) {
        best = n;
        bestCount = c;
      }
    }
    if (best > 0 && best < 500) return best;
  }

  // OCR ruim: número isolado na tabela (ex.: linha só com "5" após "Equipamentos")
  let afterEquipHeader = false;
  const isolated: number[] = [];
  for (const rawLine of obj.split(/\n+/)) {
    const line = rawLine.trim();
    if (/equipamentos/i.test(line)) {
      afterEquipHeader = true;
      continue;
    }
    if (!afterEquipHeader) continue;
    if (/^(\d{1,2})$/.test(line)) {
      const n = Number(line);
      if (n >= 1 && n <= 99) isolated.push(n);
    }
  }
  if (isolated.length === 1) return isolated[0];
  if (isolated.length > 1) {
    const freq = new Map<number, number>();
    for (const n of isolated) freq.set(n, (freq.get(n) ?? 0) + 1);
    let best = isolated[0];
    let bestCount = 0;
    for (const [n, c] of freq) {
      if (c > bestCount) {
        best = n;
        bestCount = c;
      }
    }
    if (best > 0 && best < 500) return best;
  }

  const cpu =
    obj.match(/Computador[^\d]{0,40}?(\d{1,3})/i) ??
    obj.match(/CPU[^\d]{0,20}?(\d{1,3})/i);
  if (cpu) {
    const n = Number(cpu[1]);
    if (n > 0 && n < 500) return n;
  }
  const kit = text.match(/(\d{1,3})\s*kits?\b/i);
  if (kit) {
    const n = Number(kit[1]);
    if (n > 0 && n < 500) return n;
  }
  return undefined;
}

/** CNPJ do Instituto Gustavo Hessel (CRC IGH). */
export const IGH_DONOR_CNPJ_DIGITS = "08633366000100";

/**
 * Infere o modelo do termo: IGH (layout próprio) vs INAC (modelo genérico).
 */
export function detectDonationTermTemplateKind(
  text: string,
  donorDocument?: string | null,
): "IGH" | "INAC" | null {
  const digits = (donorDocument ?? "").replace(/\D/g, "");
  if (digits === IGH_DONOR_CNPJ_DIGITS) return "IGH";
  if (/\b08\.633\.366\/0001-00\b/.test(text)) return "IGH";
  if (
    /INSTITUTO\s+GUSTAVO\s+HESSEL/i.test(text) ||
    /\bCRC\s*[- ]?\s*IGH\b/i.test(text) ||
    /\(IGH\)/i.test(text) ||
    /TERMO\s+DE\s+DOA[CÇ][AÃ]O\s+DE\s+EQUIPAMENTOS/i.test(text)
  ) {
    return "IGH";
  }
  const t = text.normalize("NFD").replace(/\p{M}/gu, "");
  if (/\bCRC\s*[- ]?\s*INAC\b/i.test(t) || /\bINAC\b/i.test(text)) return "INAC";
  if (/TERMO\s+DE\s+DOA/i.test(text)) return "INAC";
  return null;
}

export function extractDonationTermFromText(rawText: string): DonationTermSuggestion {
  const text = normalizeDonationTermOcrText(rawText);
  const donorSec = sectionBetween(
    text,
    /DOADORA\s*:?/i,
    /DONAT[ÁA]RIA/i,
  );
  const doneeSec = sectionBetween(
    text,
    /DONAT[ÁA]RIA/i,
    /OBJETO|ACORDO|OBS:/i,
  );

  const donorDocRaw =
    afterLabel(donorSec || text, ["CNPJ"]) ??
    afterLabel(text, ["CNPJ da Doadora", "CNPJ Doadora"]);
  const doneeDocRaw =
    afterLabel(doneeSec || text, ["CNPJ"]) ??
    afterLabel(text, ["CNPJ da Donatária", "CNPJ Donatária"]);

  const donorDigits = onlyDigits(donorDocRaw);
  const doneeDigits = onlyDigits(doneeDocRaw);

  const { placeDateText, donatedAt } = parsePlaceDate(text);

  const suggestion: DonationTermSuggestion = {
    donorName:
      afterLabel(donorSec, ["Nome"]) ??
      afterLabel(text, ["Instituição Doadora", "Doadora"]),
    donorDocument: donorDigits ? formatCnpjLike(donorDigits) : cleanValue(donorDocRaw),
    donorAddress: afterLabel(donorSec, ["Endereço", "Endereco"]),
    donorCity: afterLabel(donorSec, ["Cidade"]),
    donorState: afterLabel(donorSec, ["Estado", "UF"]),
    donorCep: afterLabel(donorSec, ["CEP"]),
    donorPhone: afterLabel(donorSec, ["TEL", "Telefone", "Fone"]),
    donorEmail: afterLabel(donorSec, ["Email", "E-mail"]),
    donorRepresentativeName: afterLabel(donorSec, [
      "Responsável Legal",
      "Responsavel Legal",
      "Responsável",
    ]),
    donorRepresentativeRole: afterLabel(donorSec, ["Cargo"]),
    donorRepresentativeCpf: (() => {
      const cpf = afterLabel(donorSec, ["CPF"]);
      const d = onlyDigits(cpf);
      return d ? formatCnpjLike(d) : cleanValue(cpf);
    })(),
    donatariaName: parseDonatariaName(doneeSec, text),
    donatariaDocument: doneeDigits ? formatCnpjLike(doneeDigits) : cleanValue(doneeDocRaw),
    donatariaStreet: afterLabel(doneeSec, ["Endereço", "Endereco"]),
    donatariaCity:
      afterLabel(doneeSec, ["Cidade/Município", "Cidade/Municipio", "Cidade", "Município", "Municipio"]),
    donatariaState: afterLabel(doneeSec, ["Estado", "UF"]),
    donatariaCep: afterLabel(doneeSec, ["CEP"]),
    donatariaContactName: afterLabel(doneeSec, ["Responsável", "Responsavel", "Contato"]),
    donatariaPhone: afterLabel(doneeSec, ["Telefone", "TEL", "Fone"]),
    donatariaEmail: afterLabel(doneeSec, ["E-mail", "Email"]),
    donatariaZone: parseZone(doneeSec || text),
    placeDateText,
    donatedAt,
    kitsCount: parseKitsCount(text),
    belongsTo: afterLabel(text, ["Pertence a", "Pertence à"]),
    description: /TERMO DE DOA/i.test(text) ? "Termo de doação de equipamentos" : undefined,
    templateKind:
      detectDonationTermTemplateKind(text, donorDigits ? formatCnpjLike(donorDigits) : null) ??
      undefined,
  };

  // Evita confundir CNPJ da doadora com o da donatária quando só há um bloco
  if (
    suggestion.donorDocument &&
    suggestion.donatariaDocument &&
    onlyDigits(suggestion.donorDocument) === onlyDigits(suggestion.donatariaDocument)
  ) {
    if (!suggestion.donatariaName) delete suggestion.donatariaDocument;
  }

  return suggestion;
}

export function suggestDonationTermTemplateId(
  kind: "IGH" | "INAC" | null,
  templates: Array<{ id: string; title: string }>,
): string | null {
  if (!kind || templates.length === 0) return null;
  if (kind === "IGH") {
    const igh = templates.find((t) => /\(IGH\)/i.test(t.title));
    if (igh) return igh.id;
  }
  const inac = templates.find((t) => /termo de doa/i.test(t.title) && !/\(IGH\)/i.test(t.title));
  if (inac) return inac.id;
  return templates[0]?.id ?? null;
}

export function donationTermSuggestionFilledCount(s: DonationTermSuggestion): number {
  return Object.values(s).filter((v) => v != null && v !== "").length;
}

export function isDonationTermSuggestionUseful(s: DonationTermSuggestion): boolean {
  return Boolean(
    s.donatariaName ||
      s.donatariaDocument ||
      s.donorName ||
      s.donatedAt ||
      s.placeDateText ||
      (s.kitsCount != null && s.kitsCount > 0),
  );
}

/** Nome da donatária a partir do nome do arquivo (ex.: "ASSOCIAÇÃO RATATA.pdf"). */
export function donatariaNameHintFromFileName(fileName: string | null | undefined): string | undefined {
  if (!fileName) return undefined;
  const base = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (base.length < 3) return undefined;
  if (/^(termo|doacao|doação|signed|assinado|scan|documento)(\s|$)/i.test(base)) return undefined;
  return base.slice(0, 160);
}
