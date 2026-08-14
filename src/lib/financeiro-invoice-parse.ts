/** Helpers puros de parsing de texto/QR de notas e contas (sem I/O). */

export type InvoiceSuggestion = {
  amount?: string;
  supplier?: string;
  description?: string;
  invoiceNumber?: string;
  entryDate?: string;
  /** Nome sugerido da categoria (ex.: Água, Energia). */
  categoryName?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  prestadorCnpj?: string;
};

export type KnownBillCategory = {
  name: string;
  aliases: string[];
  /** Categorias já usadas no financeiro, se não houver uma específica. */
  fallbackNames: string[];
  patterns: RegExp[];
};

/** Faturas de consumo recorrentes — usadas para pré-preencher a categoria. */
export const KNOWN_BILL_CATEGORIES: readonly KnownBillCategory[] = [
  {
    name: "Água",
    aliases: ["agua", "aguas", "saneamento", "nfag", "cosanpa", "sabesp", "cedae", "cagepa", "compesa", "sanepar"],
    fallbackNames: ["Despesas operacionais"],
    patterns: [
      /nota fiscal de [aá]gua/i,
      /\b[aá]guas?\b/i,
      /saneamento/i,
      /nfag/i,
    ],
  },
  {
    name: "Energia",
    aliases: ["energia", "luz", "eletric", "equatorial", "celpa", "cemig", "enel", "light", "cpfl", "coelba", "elektro"],
    fallbackNames: ["Despesas operacionais"],
    patterns: [
      /conta\s+de\s+luz/i,
      /energia\s+el[eé]trica/i,
      /\bequatorial\b/i,
      /\bcelpa\b/i,
      /\bcemig\b/i,
      /\benel\b/i,
    ],
  },
  {
    name: "Gás",
    aliases: ["gas", "comgas", "naturgy", "copergas"],
    fallbackNames: ["Despesas operacionais"],
    patterns: [/\bg[aá]s\b/i, /comg[aá]s/i, /naturgy/i],
  },
  {
    name: "Internet",
    aliases: ["internet", "fibra", "banda larga", "wifi"],
    fallbackNames: ["Despesas operacionais", "Serviços"],
    patterns: [/\binternet\b/i, /\bfibra\b/i, /banda\s+larga/i],
  },
  {
    name: "Telefone",
    aliases: ["telefone", "telefonia", "celular"],
    fallbackNames: ["Despesas operacionais", "Serviços"],
    // Evita falso positivo no rótulo "Telefone" de formulários (ex.: DANFS-e).
    patterns: [/conta\s+de\s+telefone/i, /fatura\s+(?:de\s+)?telefonia/i, /\btelefonia\b/i, /conta\s+de\s+celular/i],
  },
  {
    name: "IPTU",
    aliases: ["iptu", "imposto predial"],
    fallbackNames: ["Despesas operacionais"],
    patterns: [/\biptu\b/i],
  },
  {
    name: "Condomínio",
    aliases: ["condominio", "taxa condominial"],
    fallbackNames: ["Despesas operacionais"],
    patterns: [/condom[ií]nio/i],
  },
  {
    name: "Aluguel",
    aliases: ["aluguel", "locacao"],
    fallbackNames: ["Despesas operacionais"],
    patterns: [/\baluguel\b/i, /loca[cç][aã]o/i],
  },
];

export function foldCategoryKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function looksLikeNfseDocument(text: string): boolean {
  return /DANFS-?e|Documento\s+Auxiliar\s+da\s+NFS-?e|\bNFS-?e\b/i.test(text);
}

export function guessKnownBillCategory(text: string): KnownBillCategory | undefined {
  // NFS-e de serviço (MEI/prestador) não é conta de consumo.
  if (looksLikeNfseDocument(text)) return undefined;
  const haystack = `${text}`;
  for (const cat of KNOWN_BILL_CATEGORIES) {
    if (cat.patterns.some((re) => re.test(haystack))) return cat;
  }
  return undefined;
}

const PT_MONTHS: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  março: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

/** Lê valor na mesma linha ou nas próximas (layouts DANFS-e / colunas). */
function valueAfterLabel(cleaned: string, labelRe: RegExp, maxLookahead = 6): string | undefined {
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!labelRe.test(line)) continue;
    const same = line.replace(labelRe, "").replace(/^[:\-\s]+/, "").trim();
    if (same && same !== "-" && same.length >= 1) return same;
    for (let j = i + 1; j < Math.min(i + 1 + maxLookahead, lines.length); j++) {
      const next = lines[j];
      if (!next || next === "-") continue;
      // Próximo rótulo tipográfico (Title Case / termina sem valor)
      if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú /]{2,60}$/i.test(next) && !/^\d/.test(next) && !/^R\$/i.test(next)) {
        // Ainda pode ser o valor se for nome próprio longo; só pula rótulos curtos conhecidos
        if (
          /^(CNPJ|CPF|CEP|E-mail|Endere[cç]o|Munic[ií]pio|Telefone|Inscri[cç][aã]o|Nome|C[oó]digo|Local|Pa[ií]s|S[eé]rie|N[uú]mero|Data|Compet[eê]ncia|Descri[cç][aã]o|Valor|Emitente|Prestador|Tomador)/i.test(
            next,
          )
        ) {
          break;
        }
      }
      return next;
    }
  }
  return undefined;
}

function digitsOrEmpty(value: string): string {
  return value.replace(/\D/g, "");
}

function looksLikeCnpj(value: string): boolean {
  return digitsOrEmpty(value).length === 14;
}

function formatMaybeCnpj(value: string): string {
  const d = digitsOrEmpty(value);
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return value.replace(/\s+/g, " ").trim();
}

function trimBankToken(value: string): string {
  return value
    .replace(/[.,;]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Extrai banco/agência/conta/PIX do texto da NF (quando o prestador informa dados de pagamento). */
export function extractBankPaymentFields(text: string): InvoiceSuggestion {
  const cleaned = text.replace(/\u00a0/g, " ").replace(/\t/g, " ");
  const suggestion: InvoiceSuggestion = {};

  const pixRaw =
    cleaned.match(/chave\s*pix\s*[:\-]?\s*([^\n\r,;]+)/i)?.[1] ||
    valueAfterLabel(cleaned, /^chave\s*pix\b/i) ||
    cleaned.match(/\bPIX\s*[:\-]?\s*([^\n\r,;]{3,80})/i)?.[1];
  if (pixRaw) {
    const pix = trimBankToken(pixRaw.replace(/^chave\s*pix\s*[:\-]?\s*/i, ""));
    if (pix && pix !== "-" && pix.length >= 3 && !/^(banco|agencia|conta)\b/i.test(pix)) {
      suggestion.pixKey = pix.slice(0, 120);
    }
  }

  const agencyRaw =
    cleaned.match(/ag[eê]ncia\s*[:\-]?\s*(\d{1,6}(?:-?\d)?)/i)?.[1] ||
    valueAfterLabel(cleaned, /^ag[eê]ncia\b/i);
  if (agencyRaw) {
    const agency = trimBankToken(agencyRaw);
    const digits = digitsOrEmpty(agency);
    if (digits.length >= 1 && digits.length <= 8) suggestion.bankAgency = agency.slice(0, 20);
  }

  const accountRaw =
    cleaned.match(
      /conta(?:\s*(?:corrente|poupan[cç]a|pj|p\.?j\.?|pessoal(?:\s+jur[ií]dica)?))?\s*[:\-]?\s*(\d[\d.\-]*\d)/i,
    )?.[1] || valueAfterLabel(cleaned, /^conta\b/i);
  if (accountRaw) {
    const account = trimBankToken(accountRaw);
    const digits = digitsOrEmpty(account);
    if (digits.length >= 4 && digits.length <= 20 && !/pessoal/i.test(account)) {
      suggestion.bankAccount = account.slice(0, 30);
    }
  }

  const compactBank = cleaned.match(
    /([A-Za-zÁ-ú][A-Za-zÁ-ú0-9 .]{1,40}?)\s*[-–]\s*\d{3,4}\s*\/\s*Ag[eê]ncia/i,
  )?.[1];
  const labeledBank =
    cleaned.match(/\bbanco\s*[:\-]?\s*([^\n\r/,]{2,50})/i)?.[1] ||
    valueAfterLabel(cleaned, /^banco\b/i);
  const bankName = trimBankToken(compactBank || labeledBank || "");
  if (
    bankName &&
    bankName.length >= 2 &&
    !/^(ag[eê]ncia|conta|pix|chave|dados)\b/i.test(bankName) &&
    !looksLikeCnpj(bankName)
  ) {
    suggestion.bankName = bankName.replace(/\s*[-–]\s*\d{3,4}\s*$/, "").slice(0, 80);
  }

  if (!suggestion.prestadorCnpj) {
    const labeledCnpj =
      cleaned.match(
        /(?:CNPJ\s+do\s+prestador|CNPJ\s*\/\s*CPF\s*\/\s*NIF)\s*[:\-]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
      )?.[1];
    if (labeledCnpj && looksLikeCnpj(labeledCnpj)) {
      suggestion.prestadorCnpj = formatMaybeCnpj(labeledCnpj);
    }
  }

  return suggestion;
}

function parsePtLongDate(day: string, monthName: string, year: string): string | undefined {
  const mm = PT_MONTHS[monthName.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()] ?? PT_MONTHS[monthName.toLowerCase()];
  if (!mm) return undefined;
  return brDateToIso(day.padStart(2, "0"), mm, year);
}

/**
 * Extrai campos de DANFS-e (NFS-e nacional / municipal).
 * Preferência: período do serviço na descrição → competência oficial → emissão.
 */
export function extractNfseFields(text: string): InvoiceSuggestion | null {
  if (!looksLikeNfseDocument(text)) return null;
  const cleaned = text.replace(/\u00a0/g, " ").replace(/\t/g, " ");
  const suggestion: InvoiceSuggestion = {};

  const numRaw =
    valueAfterLabel(cleaned, /^N[uú]mero\s+da\s+NFS-?e\b/i) ||
    cleaned.match(/N[uú]mero\s+da\s+NFS-?e\s*[:\-]?\s*(\d{1,12})/i)?.[1];
  if (numRaw) {
    const digits = numRaw.replace(/\D/g, "");
    if (digits) suggestion.invoiceNumber = digits.replace(/^0+(?=\d)/, "") || digits;
  }

  // Chave de acesso 44 dígitos — nº da NFS-e costuma estar nas posições usadas no DANFS-e
  if (!suggestion.invoiceNumber) {
    const key = cleaned.match(/\b(\d{44})\b/)?.[1];
    if (key) {
      // Em várias chaves NFS-e o número aparece zerado à esquerda antes do ano/mês
      const embedded = key.slice(24, 33).replace(/^0+/, "");
      if (embedded) suggestion.invoiceNumber = embedded;
    }
  }

  const prestadorBlock = cleaned.match(
    /EMITENTE\s+DA\s+NFS-?e[\s\S]{0,80}?Prestador\s+do\s+Servi[cç]o([\s\S]{0,900}?)(?:TOMADOR\s+DO\s+SERVI[CÇ]O|INTERMEDI[AÁ]RIO)/i,
  );
  const prestadorText = prestadorBlock?.[1] ?? cleaned;
  const nomeEmpresarial =
    valueAfterLabel(prestadorText, /^Nome\s*\/\s*Nome\s+Empresarial\b/i) ||
    valueAfterLabel(prestadorText, /^Nome\s+Empresarial\b/i) ||
    valueAfterLabel(prestadorText, /^Nome\b/i);
  if (nomeEmpresarial && !/^TOMADOR|^INTERMEDI/i.test(nomeEmpresarial)) {
    // Remove CNPJ colado no início do nome (ex.: "64.798.644 ALEXANDRE…")
    suggestion.supplier = nomeEmpresarial
      .replace(/^\d{2}\.?\d{3}\.?\d{3}\s+/, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 120);
  }

  const servicoDesc =
    valueAfterLabel(cleaned, /^Descri[cç][aã]o\s+do\s+Servi[cç]o\b/i, 12) ||
    cleaned.match(/Descri[cç][aã]o\s+do\s+Servi[cç]o\s*[:\-]?\s*([^\n\r]{10,500})/i)?.[1];
  if (servicoDesc && servicoDesc.length >= 10) {
    // Junta linhas seguintes da descrição até o próximo bloco em maiúsculas
    const lines = cleaned.split(/\r?\n/).map((l) => l.trim());
    const start = lines.findIndex((l) => /^Descri[cç][aã]o\s+do\s+Servi[cç]o\b/i.test(l));
    if (start >= 0) {
      const parts: string[] = [];
      for (let i = start + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l || l === "-") continue;
        if (/^(TRIBUTA|VALOR\s+TOTAL|TOTAIS|INFORMA|SERVI[CÇ]O\s+PRESTADO|C[oó]digo\s+de\s+Tributa)/i.test(l)) break;
        if (/^[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚÂÊÔÃÕÇ /]{8,}$/.test(l) && parts.length > 0) break;
        parts.push(l);
        if (parts.join(" ").length > 280) break;
      }
      if (parts.length) suggestion.description = parts.join(" ").replace(/\s{2,}/g, " ").trim().slice(0, 280);
    }
    if (!suggestion.description) {
      suggestion.description = servicoDesc.replace(/\s{2,}/g, " ").trim().slice(0, 280);
    }
  }

  // Competência: período na descrição do serviço (mês efetivo do trabalho) tem prioridade.
  const period = cleaned.match(
    /per[ií]odo\s+de\s+(\d{1,2})\s+de\s+([A-Za-zçÇáéíóúãõâêôÁÉÍÓÚÃÕÂÊÔ]+)\s+de\s+(\d{4})\s+(?:[àa]|ate|até)\s+(\d{1,2})\s+de\s+([A-Za-zçÇáéíóúãõâêôÁÉÍÓÚÃÕÂÊÔ]+)\s+de\s+(\d{4})/i,
  );
  if (period) {
    const end = parsePtLongDate(period[4], period[5], period[6]);
    const start = parsePtLongDate(period[1], period[2], period[3]);
    suggestion.entryDate = end || start;
  }
  if (!suggestion.entryDate) {
    const comp =
      valueAfterLabel(cleaned, /^Compet[eê]ncia\s+da\s+NFS-?e\b/i) ||
      cleaned.match(/Compet[eê]ncia\s+da\s+NFS-?e\s*[:\-]?\s*(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/i);
    if (typeof comp === "string") {
      const m = comp.match(DATE_TOKEN);
      if (m) suggestion.entryDate = brDateToIso(m[1], m[2], m[3]);
    } else if (comp) {
      suggestion.entryDate = brDateToIso(comp[1], comp[2], comp[3]);
    }
  }

  const liquido =
    cleaned.match(/Valor\s+L[ií]quido\s+da\s+NFS-?e\s*[:\-]?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/i)?.[1] ||
    valueAfterLabel(cleaned, /^Valor\s+L[ií]quido\s+da\s+NFS-?e\b/i);
  const valorServico =
    cleaned.match(/Valor\s+do\s+Servi[cç]o\s*[:\-]?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/i)?.[1] ||
    valueAfterLabel(cleaned, /^Valor\s+do\s+Servi[cç]o\b/i);
  const amountRaw = (liquido || valorServico || "").replace(/^R\$\s*/i, "").trim();
  if (amountRaw) {
    suggestion.amount = normalizeMoneyCapture(amountRaw.match(MONEY_TOKEN)?.[0] || amountRaw);
  }

  const prestadorCnpj =
    valueAfterLabel(prestadorText, /^CNPJ\s*\/\s*CPF\s*\/\s*NIF\b/i) ||
    prestadorText.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/)?.[1];
  if (prestadorCnpj && looksLikeCnpj(prestadorCnpj)) {
    suggestion.prestadorCnpj = formatMaybeCnpj(prestadorCnpj);
  }

  return mergeSuggestion(suggestion, extractBankPaymentFields(cleaned));
}

function findByKeys(
  existingNames: Array<{ id: string; name: string }>,
  keys: string[],
): { id: string; name: string } | undefined {
  const folded = keys.map(foldCategoryKey).filter(Boolean);
  return existingNames.find((c) => {
    const n = foldCategoryKey(c.name);
    return folded.some((k) => n === k || n.includes(k) || k.includes(n));
  });
}

export function matchCategoryName(
  existingNames: Array<{ id: string; name: string }>,
  hintName: string,
): { id: string; name: string } | undefined {
  const known = KNOWN_BILL_CATEGORIES.find((c) => foldCategoryKey(c.name) === foldCategoryKey(hintName));
  const specific = findByKeys(existingNames, [
    hintName,
    ...(known?.name ? [known.name] : []),
    ...(known?.aliases ?? []),
  ]);
  if (specific) return specific;
  return findByKeys(existingNames, known?.fallbackNames ?? []);
}

export function mergeSuggestion(base: InvoiceSuggestion, extra: InvoiceSuggestion): InvoiceSuggestion {
  return {
    amount: base.amount || extra.amount,
    supplier: base.supplier || extra.supplier,
    description: base.description || extra.description,
    invoiceNumber: base.invoiceNumber || extra.invoiceNumber,
    entryDate: base.entryDate || extra.entryDate,
    categoryName: base.categoryName || extra.categoryName,
    bankName: base.bankName || extra.bankName,
    bankAgency: base.bankAgency || extra.bankAgency,
    bankAccount: base.bankAccount || extra.bankAccount,
    pixKey: base.pixKey || extra.pixKey,
    prestadorCnpj: base.prestadorCnpj || extra.prestadorCnpj,
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
    /N[UÚ]MERO\s+DA\s+NOTA\s+FISCAL\s*[:\-]?\s*(\d{1,12})/i,
    /N[UÚ]mero\s+da\s+NFS-?e\s*[:\-]?\s*(\d{1,12})/i,
    /N[º°o]\s*(?:da\s*)?(?:NF|NFS?-?E|NOTA(?:\s+FISCAL)?|FATURA)\s*[:\-]?\s*(\d{1,12})/i,
    /NF[-\s]?E?\s*(?:n[º°o.]?)?\s*[:\-]?\s*(\d{6,12})/i,
  ];
  for (const re of sameLine) {
    const m = cleaned.match(re);
    if (m?.[1]) return m[1];
  }

  // DANFS-e: "Número da NFS-e" em uma linha e o dígito na seguinte
  const nfseLines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = 0; i < nfseLines.length - 1; i++) {
    if (/^N[uú]mero\s+da\s+NFS-?e\b/i.test(nfseLines[i])) {
      const digits = nfseLines[i + 1].replace(/\D/g, "");
      if (digits.length >= 1 && digits.length <= 12) return digits.replace(/^0+(?=\d)/, "") || digits;
    }
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

const DATE_TOKEN = /(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/;

function pickEntryDate(cleaned: string): string | undefined {
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const findDateAfterLabel = (labelRe: RegExp): string | undefined => {
    const idx = lines.findIndex((l) => labelRe.test(l));
    if (idx < 0) return undefined;
    const same = lines[idx].match(DATE_TOKEN);
    if (same) return brDateToIso(same[1], same[2], same[3]);
    for (let i = idx + 1; i < Math.min(idx + 12, lines.length); i++) {
      const whole = lines[i].match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})$/);
      if (whole) return brDateToIso(whole[1], whole[2], whole[3]);
      // Conta de água: "15/09/2026 R$ 219,76"
      const withAmount = lines[i].match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})\s+R\$/i);
      if (withAmount) return brDateToIso(withAmount[1], withAmount[2], withAmount[3]);
    }
    return undefined;
  };

  return (
    findDateAfterLabel(/Data\s+de\s+Vencimento/i) ||
    findDateAfterLabel(/\bVENCIMENTO\b/i) ||
    findDateAfterLabel(/Data\s+de\s+Emiss/i) ||
    (() => {
      const venc = cleaned.match(
        /VENCIMENTO\s*[:\-]?\s*(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/i,
      );
      if (venc) return brDateToIso(venc[1], venc[2], venc[3]);
      const emissao = cleaned.match(
        /DATA\s*(?:DE\s*)?(?:EMISS[AÃ]O|SA[IÍ]DA)\s*[:\-]?\s*(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/i,
      );
      if (emissao) return brDateToIso(emissao[1], emissao[2], emissao[3]);
      return undefined;
    })()
  );
}

function pickSupplier(cleaned: string): string | undefined {
  // Evita capturar "DA NFS-e" a partir de "EMITENTE DA NFS-e".
  const razao = cleaned.match(
    /(?:RAZ[AÃ]O\s+SOCIAL|NOME\s+(?:EMPRESARIAL|FANTASIA)|NOME\s*\/\s*NOME\s+EMPRESARIAL|FORNECEDOR)\s*[:\-]?\s*([^\n\r|]{3,80})/i,
  );
  if (razao?.[1]) {
    const name = razao[1]
      .replace(/^\d{2}\.?\d{3}\.?\d{3}\s+/, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 120);
    if (name && !/^DA\s+NFS/i.test(name)) return name;
  }

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
  const nfse = extractNfseFields(text);
  if (nfse && (nfse.amount || nfse.invoiceNumber || nfse.supplier || nfse.description)) {
    // Completa lacunas com heurísticas genéricas (valor etc.), sem sobrescrever NFS-e.
    return mergeSuggestion(nfse, extractFieldsFromTextGeneric(text));
  }
  return extractFieldsFromTextGeneric(text);
}

function extractFieldsFromTextGeneric(text: string): InvoiceSuggestion {
  const suggestion: InvoiceSuggestion = {};
  const cleaned = text.replace(/\u00a0/g, " ").replace(/\t/g, " ");

  suggestion.amount = pickAmountFromText(cleaned);
  suggestion.entryDate = pickEntryDate(cleaned);
  suggestion.invoiceNumber = pickInvoiceNumber(cleaned);
  suggestion.supplier = pickSupplier(cleaned);

  const known = guessKnownBillCategory(cleaned);
  if (known) suggestion.categoryName = known.name;

  if (!suggestion.description) {
    const bits = [
      known
        ? `Conta de ${known.name.toLowerCase()}`
        : suggestion.supplier
          ? `Conta — ${suggestion.supplier}`
          : null,
      suggestion.invoiceNumber ? `Doc ${suggestion.invoiceNumber}` : null,
    ].filter(Boolean);
    if (bits.length) suggestion.description = bits.join(" · ");
    else if (suggestion.amount) suggestion.description = `Conta / nota R$ ${suggestion.amount}`;
  }

  return mergeSuggestion(suggestion, extractBankPaymentFields(cleaned));
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
