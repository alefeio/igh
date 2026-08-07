import type {
  BankAccountType,
  EmployeeDocumentType,
  EmployeePosition,
  EmployeeStatus,
  EmploymentType,
  PixKeyType,
  UniformSize,
} from "@/generated/prisma/client";

/** Documento como devolvido pelas APIs da gerência (datas já em string). */
export type EmployeeDocumentView = {
  id: string;
  type: EmployeeDocumentType;
  title: string | null;
  referenceMonth: string | null;
  amountCents: number | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string;
  createdAt: string;
  uploadedByUser: { id: string; name: string } | null;
};

/** Ficha de colaborador como devolvida pelas APIs da gerência. */
export type EmployeeView = {
  id: string;
  userId: string | null;
  name: string;
  cpf: string;
  rg: string | null;
  rgIssuer: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  position: EmployeePosition;
  positionLabel: string | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  admissionDate: string | null;
  terminationDate: string | null;
  monthlyPayCents: number | null;
  uniformSize: UniformSize | null;
  shoeSize: string | null;
  meiCnpj: string | null;
  meiCompanyName: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountType: BankAccountType | null;
  pixKeyType: PixKeyType | null;
  pixKey: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  poloId: string | null;
  polo: { id: string; name: string } | null;
  user: { id: string; name: string; email: string; role: string; isActive: boolean } | null;
  documents: EmployeeDocumentView[];
  missingDocuments: EmployeeDocumentType[];
  createdAt: string;
  updatedAt: string;
};

export const EMPLOYEE_POSITIONS: readonly EmployeePosition[] = [
  "DIRETOR",
  "GERENTE",
  "COORDENADOR_POLO",
  "PROFESSOR",
  "ADMINISTRATIVO",
  "OPERACIONAL",
  "MOTORISTA",
  "VIGIA",
  "LIMPEZA",
] as const;

export const EMPLOYEE_POSITION_LABEL: Record<EmployeePosition, string> = {
  DIRETOR: "Diretor",
  GERENTE: "Gerente",
  COORDENADOR_POLO: "Coordenador de polo",
  PROFESSOR: "Professor",
  ADMINISTRATIVO: "Administrativo",
  OPERACIONAL: "Operacional",
  MOTORISTA: "Motorista",
  VIGIA: "Vigia",
  LIMPEZA: "Limpeza",
};

export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "MEI",
  "CLT",
  "PRESTADOR",
  "VOLUNTARIO",
  "ESTAGIO",
] as const;

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  MEI: "MEI",
  CLT: "CLT",
  PRESTADOR: "Prestador de serviço",
  VOLUNTARIO: "Voluntário",
  ESTAGIO: "Estágio",
};

export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = ["ATIVO", "AFASTADO", "DESLIGADO"] as const;

export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  ATIVO: "Ativo",
  AFASTADO: "Afastado",
  DESLIGADO: "Desligado",
};

export const UNIFORM_SIZES: readonly UniformSize[] = ["PP", "P", "M", "G", "GG", "XG", "XGG"] as const;

export const BANK_ACCOUNT_TYPES: readonly BankAccountType[] = [
  "CORRENTE",
  "POUPANCA",
  "PAGAMENTO",
] as const;

export const BANK_ACCOUNT_TYPE_LABEL: Record<BankAccountType, string> = {
  CORRENTE: "Conta corrente",
  POUPANCA: "Conta poupança",
  PAGAMENTO: "Conta de pagamento",
};

export const PIX_KEY_TYPES: readonly PixKeyType[] = [
  "CPF",
  "CNPJ",
  "EMAIL",
  "TELEFONE",
  "ALEATORIA",
] as const;

export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
  ALEATORIA: "Chave aleatória",
};

export const EMPLOYEE_DOCUMENT_TYPES: readonly EmployeeDocumentType[] = [
  "RG",
  "CPF",
  "CNPJ_MEI",
  "COMPROVANTE_RESIDENCIA",
  "DADOS_BANCARIOS",
  "CONTRATO",
  "DISTRATO",
  "NOTA_MENSAL",
  "OUTRO",
] as const;

export const EMPLOYEE_DOCUMENT_TYPE_LABEL: Record<EmployeeDocumentType, string> = {
  RG: "RG",
  CPF: "CPF",
  CNPJ_MEI: "Cadastro MEI",
  COMPROVANTE_RESIDENCIA: "Comprovante de residência",
  DADOS_BANCARIOS: "Conta bancária / Pix",
  CONTRATO: "Contrato de colaborador",
  DISTRATO: "Distrato de colaborador",
  NOTA_MENSAL: "Nota mensal",
  OUTRO: "Outro documento",
};

/** Documentos exigidos na admissão. A ficha fica "incompleta" enquanto faltar algum. */
export const REQUIRED_EMPLOYEE_DOCUMENTS: readonly EmployeeDocumentType[] = [
  "RG",
  "CPF",
  "COMPROVANTE_RESIDENCIA",
  "DADOS_BANCARIOS",
] as const;

/** O cadastro MEI só é exigido de quem tem esse vínculo. */
export function requiredDocumentsFor(
  employmentType: EmploymentType,
): readonly EmployeeDocumentType[] {
  return employmentType === "MEI"
    ? [...REQUIRED_EMPLOYEE_DOCUMENTS, "CNPJ_MEI"]
    : REQUIRED_EMPLOYEE_DOCUMENTS;
}

export function missingRequiredDocuments(
  employmentType: EmploymentType,
  presentTypes: readonly EmployeeDocumentType[],
): EmployeeDocumentType[] {
  return requiredDocumentsFor(employmentType).filter((t) => !presentTypes.includes(t));
}

/** Cargo exibido: usa o rótulo livre quando informado. */
export function employeePositionText(employee: {
  position: EmployeePosition;
  positionLabel?: string | null;
}): string {
  return employee.positionLabel?.trim() || EMPLOYEE_POSITION_LABEL[employee.position];
}

export function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return value;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatCentsBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-08" → competência normalizada no dia 1º (UTC), como gravado no banco. */
export function referenceMonthToDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

export function formatReferenceMonth(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}
