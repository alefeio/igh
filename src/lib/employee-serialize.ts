import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { missingRequiredDocuments, type EmployeeView } from "@/lib/employees";

export const employeeSelect = {
  id: true,
  userId: true,
  name: true,
  cpf: true,
  rg: true,
  rgIssuer: true,
  birthDate: true,
  email: true,
  phone: true,
  position: true,
  positionLabel: true,
  employmentType: true,
  status: true,
  admissionDate: true,
  terminationDate: true,
  monthlyPayCents: true,
  fundingChannel: true,
  fundingContractRef: true,
  offBooksPayCents: true,
  uniformSize: true,
  shoeSize: true,
  meiCnpj: true,
  meiCompanyName: true,
  bankName: true,
  bankAgency: true,
  bankAccount: true,
  bankAccountType: true,
  pixKeyType: true,
  pixKey: true,
  cep: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
  notes: true,
  poloId: true,
  createdAt: true,
  updatedAt: true,
  polo: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
  documents: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      title: true,
      referenceMonth: true,
      amountCents: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      url: true,
      createdAt: true,
      uploadedByUser: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.EmployeeSelect;

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;

const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

export function serializeEmployee(employee: EmployeeRow): EmployeeView {
  return {
    ...employee,
    birthDate: dateOnly(employee.birthDate),
    admissionDate: dateOnly(employee.admissionDate),
    terminationDate: dateOnly(employee.terminationDate),
    documents: employee.documents.map((d) => ({
      ...d,
      referenceMonth: dateOnly(d.referenceMonth),
      createdAt: d.createdAt.toISOString(),
    })),
    missingDocuments: missingRequiredDocuments(
      employee.employmentType,
      employee.documents.map((d) => d.type),
    ),
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
