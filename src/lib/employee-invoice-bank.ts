/** Comparação de dados bancários da NFS-e com o cadastro do colaborador (sem I/O). */

export type EmployeeBankSnapshot = {
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountType: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  meiCnpj: string | null;
};

export type ExtractedInvoiceBankData = {
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  prestadorCnpj?: string;
};

export type BankMismatchCheck = {
  hasExtractedBankData: boolean;
  mismatches: string[];
  employeeSnapshot: EmployeeBankSnapshot;
  extracted: ExtractedInvoiceBankData;
};

export function hasExtractedBankData(extracted: ExtractedInvoiceBankData): boolean {
  return Boolean(
    extracted.bankName ||
      extracted.bankAgency ||
      extracted.bankAccount ||
      extracted.pixKey ||
      extracted.prestadorCnpj,
  );
}

export function extractedBankFromSuggestion(suggestion: ExtractedInvoiceBankData): ExtractedInvoiceBankData {
  const extracted: ExtractedInvoiceBankData = {};
  if (suggestion.bankName?.trim()) extracted.bankName = suggestion.bankName.trim();
  if (suggestion.bankAgency?.trim()) extracted.bankAgency = suggestion.bankAgency.trim();
  if (suggestion.bankAccount?.trim()) extracted.bankAccount = suggestion.bankAccount.trim();
  if (suggestion.pixKey?.trim()) extracted.pixKey = suggestion.pixKey.trim();
  if (suggestion.prestadorCnpj?.trim()) extracted.prestadorCnpj = suggestion.prestadorCnpj.trim();
  return extracted;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+(?=\d)/, "");
  return stripped || "0";
}

function foldBankName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(banco|banrisul|sa|s\/a|ltda|spe|pagamentos)\b/g, " ")
    .replace(/\b\d{3,4}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BANK_ALIASES: Array<{ keys: string[]; canon: string }> = [
  { keys: ["nubank", "nu bank", "nu"], canon: "nu" },
  { keys: ["itau unibanco", "itau"], canon: "itau" },
  { keys: ["bradesco"], canon: "bradesco" },
  { keys: ["banco do brasil", "bb"], canon: "bb" },
  { keys: ["santander"], canon: "santander" },
  { keys: ["caixa economica", "caixa"], canon: "caixa" },
  { keys: ["inter"], canon: "inter" },
  { keys: ["c6"], canon: "c6" },
  { keys: ["picpay"], canon: "picpay" },
  { keys: ["mercado pago", "mercadopago"], canon: "mercadopago" },
];

function canonBankName(folded: string): string {
  for (const alias of BANK_ALIASES) {
    if (alias.keys.some((k) => folded === k || folded.includes(k))) return alias.canon;
  }
  return folded;
}

export function bankNamesMatch(a: string, b: string): boolean {
  const fa = foldBankName(a);
  const fb = foldBankName(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  if (fa.includes(fb) || fb.includes(fa)) return true;
  return canonBankName(fa) === canonBankName(fb);
}

/** CPF/CNPJ/telefone → só dígitos; e-mail/aleatória → minúsculo sem espaços. */
export function normalizePixOrCnpj(value: string): string {
  const t = value.trim();
  if (!t) return "";
  const compact = t.replace(/\s+/g, "");
  const digits = digitsOnly(compact);
  const alnum = compact.replace(/[^\dA-Za-z@._+-]/g, "");
  if (digits.length >= 10 && digits.length >= alnum.length * 0.6) return digits;
  return compact.toLowerCase();
}

export function digitsMatch(a: string, b: string, stripZeros = false): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (stripZeros) return stripLeadingZeros(da) === stripLeadingZeros(db);
  return false;
}

function formatMismatch(label: string, extracted: string, registered: string | null): string {
  if (!registered?.trim()) {
    return `${label} na nota (${extracted}) não consta no cadastro`;
  }
  return `${label}: nota “${extracted}” ≠ cadastro “${registered}”`;
}

export function compareEmployeeBankData(
  employee: EmployeeBankSnapshot,
  suggestion: ExtractedInvoiceBankData,
): BankMismatchCheck {
  const extracted = extractedBankFromSuggestion(suggestion);
  const mismatches: string[] = [];

  if (extracted.bankName) {
    if (!employee.bankName?.trim() || !bankNamesMatch(employee.bankName, extracted.bankName)) {
      mismatches.push(formatMismatch("Banco", extracted.bankName, employee.bankName));
    }
  }
  if (extracted.bankAgency) {
    if (!employee.bankAgency?.trim() || !digitsMatch(employee.bankAgency, extracted.bankAgency, true)) {
      mismatches.push(formatMismatch("Agência", extracted.bankAgency, employee.bankAgency));
    }
  }
  if (extracted.bankAccount) {
    if (!employee.bankAccount?.trim() || !digitsMatch(employee.bankAccount, extracted.bankAccount, false)) {
      mismatches.push(formatMismatch("Conta", extracted.bankAccount, employee.bankAccount));
    }
  }
  if (extracted.pixKey) {
    if (!employee.pixKey?.trim() || normalizePixOrCnpj(employee.pixKey) !== normalizePixOrCnpj(extracted.pixKey)) {
      mismatches.push(formatMismatch("PIX", extracted.pixKey, employee.pixKey));
    }
  }
  if (extracted.prestadorCnpj) {
    if (
      !employee.meiCnpj?.trim() ||
      normalizePixOrCnpj(employee.meiCnpj) !== normalizePixOrCnpj(extracted.prestadorCnpj)
    ) {
      mismatches.push(formatMismatch("CNPJ do prestador", extracted.prestadorCnpj, employee.meiCnpj));
    }
  }

  return {
    hasExtractedBankData: hasExtractedBankData(extracted),
    mismatches,
    employeeSnapshot: employee,
    extracted,
  };
}

export function serializeBankMismatchDetails(check: BankMismatchCheck): string {
  return JSON.stringify({
    mismatches: check.mismatches,
    extracted: check.extracted,
    employeeSnapshot: check.employeeSnapshot,
  });
}
