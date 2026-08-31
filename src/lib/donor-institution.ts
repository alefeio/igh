import "server-only";

import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";

import type { DonorInstitutionView } from "@/lib/donor-institution-ui";

export type { DonorInstitutionView };

const donorSelect = {
  id: true,
  name: true,
  document: true,
  email: true,
  address: true,
  city: true,
  state: true,
  cep: true,
  phone: true,
  representativeName: true,
  representativeRole: true,
  representativeCpf: true,
  isActive: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getOrCreateDonorInstitutionSettings(actorId?: string | null) {
  const existing = await prisma.donorInstitutionSettings.findFirst({
    where: { deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  if (existing) return existing;

  return prisma.donorInstitutionSettings.create({
    data: {
      name: BRAND.legalName,
      isActive: true,
      isDefault: true,
      updatedByUserId: actorId ?? null,
    },
  });
}

export async function listDonorInstitutions() {
  await getOrCreateDonorInstitutionSettings();
  return prisma.donorInstitutionSettings.findMany({
    where: { deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { donations: true } } },
  });
}

export async function resolveDonorInstitution(id?: string | null, actorId?: string | null) {
  if (id) {
    const found = await prisma.donorInstitutionSettings.findFirst({
      where: { id, deletedAt: null },
    });
    if (found) return found;
  }
  const preferred = await prisma.donorInstitutionSettings.findFirst({
    where: { deletedAt: null, isActive: true, isDefault: true },
  });
  if (preferred) return preferred;
  return getOrCreateDonorInstitutionSettings(actorId);
}

export async function setDefaultDonorInstitution(id: string, actorId?: string | null) {
  await prisma.$transaction([
    prisma.donorInstitutionSettings.updateMany({
      where: { deletedAt: null, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    }),
    prisma.donorInstitutionSettings.update({
      where: { id },
      data: { isDefault: true, isActive: true, updatedByUserId: actorId ?? null },
    }),
  ]);
}

export function serializeDonorInstitution(
  row: {
    id: string;
    name: string | null;
    document: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
    phone: string | null;
    representativeName: string | null;
    representativeRole: string | null;
    representativeCpf: string | null;
    isActive?: boolean;
    isDefault?: boolean;
    createdAt?: Date;
    updatedAt: Date;
    _count?: { donations: number };
  },
): DonorInstitutionView {
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    cep: row.cep,
    phone: row.phone,
    representativeName: row.representativeName,
    representativeRole: row.representativeRole,
    representativeCpf: row.representativeCpf,
    isActive: row.isActive ?? true,
    isDefault: row.isDefault ?? false,
    createdAt: (row.createdAt ?? row.updatedAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row._count ? { _count: row._count } : {}),
  };
}

export function donorInstitutionVariableMap(
  donor: {
    name?: string | null;
    document?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    cep?: string | null;
    phone?: string | null;
    representativeName?: string | null;
    representativeRole?: string | null;
    representativeCpf?: string | null;
  } | null,
): Record<string, string> {
  const name = donor?.name?.trim() || BRAND.legalName || BRAND.shortName || "Instituto";
  const addr = [
    donor?.address,
    donor?.city && donor?.state ? `${donor.city}/${donor.state}` : donor?.city || donor?.state,
    donor?.cep,
  ]
    .filter(Boolean)
    .join(", ");

  const instituto: Record<string, string> = {
    "instituto.nome": name,
    "instituto.cnpj": donor?.document?.trim() || "—",
    "instituto.email": donor?.email?.trim() || "—",
    "instituto.logradouro": donor?.address?.trim() || "—",
    "instituto.endereco": addr || "—",
    "instituto.cidade": donor?.city?.trim() || "—",
    "instituto.estado": donor?.state?.trim() || "—",
    "instituto.cep": donor?.cep?.trim() || "—",
    "instituto.telefone": donor?.phone?.trim() || "—",
    "instituto.responsavel": donor?.representativeName?.trim() || "—",
    "instituto.cargo": donor?.representativeRole?.trim() || "—",
    "instituto.cpf": donor?.representativeCpf?.trim() || "—",
    "instituto.responsavel_rg": "—",
    "instituto.responsavel_estado_civil": "—",
    "instituto.responsavel_endereco": "—",
  };
  const doadora = Object.fromEntries(
    Object.entries(instituto).map(([key, value]) => [key.replace("instituto.", "doadora."), value]),
  );
  return { ...instituto, ...doadora };
}

export { donorSelect };
