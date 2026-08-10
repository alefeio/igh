/** Helpers puros de parsing de texto/QR de notas e contas (sem I/O). */

export type InvoiceSuggestion = {
  amount?: string;
  supplier?: string;
  description?: string;
  invoiceNumber?: string;
  entryDate?: string;
};

export function mergeSuggestion(base: InvoiceSuggestion, extra: InvoiceSuggestion): InvoiceSuggestion {
  return {
    amount: base.amount || extra.amount,
    supplier: base.supplier || extra.supplier,
    description: base.description || extra.description,
    invoiceNumber: base.invoiceNumber || extra.invoiceNumber,
    entryDate: base.entryDate || extra.entryDate,
  };
}

export function suggestionFilledCount(s: InvoiceSuggestion) {
  return [s.amount, s.supplier, s.description, s.invoiceNumber, s.entryDate].filter(Boolean).length;
}

export function isCompleteEnough(s: InvoiceSuggestion) {
  return Boolean(s.amount && (s.supplier || s.description || s.invoiceNumber));
}

/** Converte data BR dd/mm/yyyy → yyyy-mm-dd */
function brDateToIso(d: string, m: string, y: string): string | undefined {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y.length === 2 ? `20${y}` : y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatAmountFromNumber(n: number): string | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n.toFixed(2).replace(".", ",");
}

/** Aceita 26,97 | 1.250,90 | 26.97 e devolve string BR. */
export function normalizeMoneyCapture(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  // BR com milhar: 1.250,90
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(t)) return t;
  // BR simples: 26,97
  if (/^\d+,\d{2}$/.test(t)) return t;
  // US/ponto: 26.97
  if (/^\d+\.\d{2}$/.test(t)) {
    return formatAmountFromNumber(Number(t));
  }
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return formatAmountFromNumber(n);
}

const MONEY_TOKEN = String.raw`(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})`;

function pickAmountFromText(cleaned: string): string | undefined {
  const preferred: Array<{ re: RegExp; group?: number }> = [
    { re: new RegExp(String.raw`TOTAL\s+A\s+PAGAR\s*[:\-]?\s*${MONEY_TOKEN}`, "i") },
    { re: new RegExp(String.raw`TOTAL\s*(?:LIQUIDO|L[IÍ]QUIDO|GERAL|DA\s+FATURA)?\s*[:\-]?\s*R?\$?\s*${MONEY_TOKEN}`, "i") },
    { re: new RegExp(String.raw`VALOR\s*(?:TOTAL|A\s+PAGAR|DA\s+FATURA|DA\s+NOTA)?\s*[:\-]?\s*R?\$?\s*${MONEY_TOKEN}`, "i") },
    { re: new RegExp(String.raw`R\$\s*${MONEY_TOKEN}`, "gi") },
  ];

  for (const { re } of preferred) {
    if (re.flags.includes("g")) {
      const matches = [...cleaned.matchAll(re)];
      // Prefer the last R$ that looks like a bill total (ignore tiny noise)
      for (let i = matches.length - 1; i >= 0; i--) {
        const norm = normalizeMoneyCapture(matches[i][1]);
        if (!norm) continue;
        const cents = Math.round(Number(norm.replace(/\./g, "").replace(",", ".")) * 100);
        if (cents >= 100) return norm; // >= R$ 1,00
      }
    } else {
      const m = cleaned.match(re);
      if (m?.[1]) {
        const norm = normalizeMoneyCapture(m[1]);
        if (norm) return norm;
      }
    }
  }
  return undefined;
}

function pickInvoiceNumber(cleaned: string): string | undefined {
  const sameLine = [
    /Fatura\s*n[º°o.]?\s*[:\-]?\s*(\d{5,12})/i,
    /N[º°o]\s*(?:da\s*)?(?:NF|NFS?-?E|NOTA(?:\s+FISCAL)?|FATURA)\s*[:\-]?\s*(\d{1,12})/i,
    /NF[-\s]?E?\s*(?:n[º°o.]?)?\s*[:\-]?\s*(\d{6,12})/i,
  ];
  for (const re of sameLine) {
    const m = cleaned.match(re);
    if (m?.[1]) return m[1];
  }

  // Contas de água: coluna de rótulos seguida da coluna de valores
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const isLabel = (l: string) =>
    /^(Mátricula|Matricula|Fatura|Referência|Referencia|Valor|Data de|CNPJ|TELEFONE|ENDERE|MORADOR|DADOS|Hora)/i.test(
      l,
    );
  const isValueLine = (l: string) =>
    /^[\dR$]/.test(l) && !isLabel(l) && (/^\d/.test(l) || /^R\$/.test(l));

  let labelStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(Mátricula|Matricula|Fatura\s*n)/i.test(lines[i])) {
      labelStart = i;
      break;
    }
  }
  if (labelStart >= 0) {
    const labels: string[] = [];
    let i = labelStart;
    while (i < lines.length && isLabel(lines[i])) {
      labels.push(lines[i]);
      i++;
    }
    const values: string[] = [];
    while (i < lines.length && values.length < labels.length + 2) {
      if (isValueLine(lines[i])) values.push(lines[i]);
      else if (values.length > 0) break;
      i++;
    }
    const faturaLabelIdx = labels.findIndex((l) => /^Fatura\s*n/i.test(l));
    if (faturaLabelIdx >= 0 && values[faturaLabelIdx]) {
      const digits = values[faturaLabelIdx].replace(/\D/g, "");
      if (digits.length >= 5) return digits;
    }
  }

  return undefined;
}

function pickEntryDate(cleaned: string): string | undefined {
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const findDateAfterLabel = (labelRe: RegExp): string | undefined => {
    const idx = lines.findIndex((l) => labelRe.test(l));
    if (idx < 0) return undefined;
    const same = lines[idx].match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/);
    if (same) return brDateToIso(same[1], same[2], same[3]);
    for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i++) {
      const m = lines[i].match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})$/);
      if (m) return brDateToIso(m[1], m[2], m[3]);
    }
    return undefined;
  };

  return (
    findDateAfterLabel(/Data\s+de\s+Vencimento/i) ||
    findDateAfterLabel(/Data\s+de\s+Emiss/i) ||
    (() => {
      const labeled = cleaned.match(
        /(?:DATA\s*(?:DE\s*)?(?:EMISS[AÃ]O|SA[IÍ]DA|VENCIMENTO)?\s*[:\-]?\s*)(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/i,
      );
      if (labeled) return brDateToIso(labeled[1], labeled[2], labeled[3]);
      const any = cleaned.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
      if (any) return brDateToIso(any[1], any[2], any[3]);
      return undefined;
    })()
  );
}

function pickSupplier(cleaned: string): string | undefined {
  const razao = cleaned.match(
    /(?:RAZ[AÃ]O\s+SOCIAL|NOME\s+(?:EMPRESARIAL|FANTASIA)|EMITENTE|PRESTADOR|FORNECEDOR)\s*[:\-]?\s*([^\n\r|]{3,80})/i,
  );
  if (razao?.[1]) return razao[1].replace(/\s{2,}/g, " ").trim().slice(0, 120);

  const utility = cleaned.match(
    /\b((?:AGUAS?|ÁGUAS?|COMPANHIA|CIA\.?|SANEAMENTO|ENERGIA|ELETR[OI]CA|TELEF[OÔ]NICA|CLARO|VIVO|TIM|OI)[^\n\r|]{0,60}(?:S\.?\s*A\.?|SPE|LTDA)?)/i,
  );
  if (utility?.[1]) return utility[1].replace(/\s{2,}/g, " ").trim().slice(0, 120);

  const cnpjMatch = cleaned.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  if (cnpjMatch) {
    // Tenta pegar a linha anterior/próxima com nome da empresa
    const around = cleaned.match(
      new RegExp(
        String.raw`([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\.\,\-\/&]{4,70})\s*\n[^\n]*${cnpjMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i",
      ),
    );
    if (around?.[1]) return around[1].replace(/\s{2,}/g, " ").trim().slice(0, 120);
    return `CNPJ ${cnpjMatch[1]}`;
  }
  return undefined;
}

export function extractFieldsFromText(text: string): InvoiceSuggestion {
  const suggestion: InvoiceSuggestion = {};
  const cleaned = text.replace(/\u00a0/g, " ").replace(/\t/g, " ");

  suggestion.amount = pickAmountFromText(cleaned);
  suggestion.entryDate = pickEntryDate(cleaned);
  suggestion.invoiceNumber = pickInvoiceNumber(cleaned);
  suggestion.supplier = pickSupplier(cleaned);

  if (!suggestion.description) {
    const bits = [
      suggestion.supplier
        ? suggestion.supplier.startsWith("CNPJ")
          ? `Conta — ${suggestion.supplier}`
          : `Conta — ${suggestion.supplier}`
        : null,
      suggestion.invoiceNumber ? `Doc ${suggestion.invoiceNumber}` : null,
    ].filter(Boolean);
    if (bits.length) suggestion.description = bits.join(" · ");
    else if (suggestion.amount) suggestion.description = `Conta / nota R$ ${suggestion.amount}`;
  }

  return suggestion;
}

export function parseQrPayload(raw: string): InvoiceSuggestion {
  const suggestion: InvoiceSuggestion = {};
  const text = raw.trim();

  try {
    if (/^https?:\/\//i.test(text)) {
      const u = new URL(text);
      const params = u.searchParams;
      const chNFe = params.get("chNFe") || params.get("p") || "";
      if (chNFe && /^\d{44}$/.test(chNFe.replace(/\D/g, ""))) {
        const key = chNFe.replace(/\D/g, "");
        suggestion.invoiceNumber = key.slice(25, 34).replace(/^0+/, "") || key.slice(-9);
        suggestion.description = `NFC-e chave ${key.slice(0, 8)}…`;
      }
      const v = params.get("vNF") || params.get("valor") || params.get("v");
      if (v) {
        const n = Number(String(v).replace(",", "."));
        suggestion.amount = formatAmountFromNumber(n) ?? String(v).replace(".", ",");
      }
      const dh = params.get("dhEmi") || params.get("data");
      if (dh) {
        const m = dh.match(/(\d{4})-(\d{2})-(\d{2})/) || dh.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
        if (m) {
          suggestion.entryDate =
            m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : brDateToIso(m[1], m[2], m[3]);
        }
      }
      suggestion.supplier = suggestion.supplier || u.hostname.replace(/^www\./, "");
      return mergeSuggestion(suggestion, extractFieldsFromText(text));
    }
  } catch {
    // fall through
  }

  return mergeSuggestion(suggestion, extractFieldsFromText(text));
}
