/** Helpers puros de parsing de texto/QR de notas (sem I/O). */

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

export function extractFieldsFromText(text: string): InvoiceSuggestion {
  const suggestion: InvoiceSuggestion = {};
  const cleaned = text.replace(/\u00a0/g, " ");

  const moneyMatches = [
    ...cleaned.matchAll(
      /(?:R\$\s*|TOTAL\s*(?:LIQUIDO|L[IÍ]QUIDO)?\s*[:\-]?\s*|VALOR\s*(?:TOTAL|DA\s+NOTA)?\s*[:\-]?\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi,
    ),
  ];
  if (moneyMatches.length > 0) {
    const last = moneyMatches[moneyMatches.length - 1];
    suggestion.amount = last[1];
  }

  const dateMatch =
    cleaned.match(
      /(?:DATA\s*(?:DE\s*)?(?:EMISS[AÃ]O|SA[IÍ]DA)?\s*[:\-]?\s*)(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/i,
    ) || cleaned.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
  if (dateMatch) {
    suggestion.entryDate = brDateToIso(dateMatch[1], dateMatch[2], dateMatch[3]);
  }

  const nfMatch =
    cleaned.match(
      /(?:N[º°o]\s*(?:DA\s*)?(?:NF|NFS?-?E|NOTA(?:\s+FISCAL)?)|NF-?E?\s*N[º°o]?)\s*[:\-]?\s*(\d{1,12})/i,
    ) || cleaned.match(/\bNF[-\s]?E?\s*[:\-]?\s*(\d{6,12})\b/i);
  if (nfMatch) suggestion.invoiceNumber = nfMatch[1];

  const cnpjMatch = cleaned.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  const razaoMatch = cleaned.match(
    /(?:RAZ[AÃ]O\s+SOCIAL|NOME\s+(?:EMPRESARIAL|FANTASIA)|EMITENTE|PRESTADOR|FORNECEDOR)\s*[:\-]?\s*([^\n\r|]{3,80})/i,
  );
  if (razaoMatch) {
    suggestion.supplier = razaoMatch[1].replace(/\s{2,}/g, " ").trim().slice(0, 120);
  } else if (cnpjMatch) {
    suggestion.supplier = `CNPJ ${cnpjMatch[1]}`;
  }

  if (!suggestion.description) {
    const bits = [
      suggestion.supplier ? `Nota — ${suggestion.supplier}` : null,
      suggestion.invoiceNumber ? `NF ${suggestion.invoiceNumber}` : null,
    ].filter(Boolean);
    if (bits.length) suggestion.description = bits.join(" · ");
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
