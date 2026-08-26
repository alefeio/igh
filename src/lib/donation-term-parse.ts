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

function cleanValue(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const v = raw
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[:\-–—|.\s]+/, "")
    .replace(/\s+$/, "")
    .trim();
  if (!v || /^[\-–—_]+$/.test(v)) return undefined;
  return v.slice(0, 240);
}

function onlyDigits(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const d = v.replace(/\D/g, "");
  return d.length >= 11 ? d : undefined;
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
    const v = cleanValue(m?.[1]);
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

function parseKitsCount(text: string): number | undefined {
  // Heurística: quantidade de "Computador" / "CPU" na tabela OBJETO
  const obj = sectionBetween(text, /OBJETO/i, /OBS:|ACORDO|São obrigações/i);
  const cpu = obj.match(/Computador[^\d]{0,40}?(\d{1,3})/i)
    ?? obj.match(/CPU[^\d]{0,20}?(\d{1,3})/i);
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

export function extractDonationTermFromText(rawText: string): DonationTermSuggestion {
  const text = rawText.replace(/\u0000/g, " ").replace(/\r/g, "\n");
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
    donatariaName:
      afterLabel(doneeSec, ["Instituição", "Instituicao", "Nome"]) ??
      afterLabel(text, ["Donatária", "Donataria"]),
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
  };

  // Evita confundir CNPJ da doadora com o da donatária quando só há um bloco
  if (
    suggestion.donorDocument &&
    suggestion.donatariaDocument &&
    onlyDigits(suggestion.donorDocument) === onlyDigits(suggestion.donatariaDocument)
  ) {
    // Se nomes diferentes, mantém; se iguais, limpa donatária doc se nome vazio
    if (!suggestion.donatariaName) delete suggestion.donatariaDocument;
  }

  return suggestion;
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
