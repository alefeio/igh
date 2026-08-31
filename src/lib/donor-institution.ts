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

const IGH_INSTITUTE_DEFAULTS = {
  document: "08.633.366/0001-00",
  address: "TV. Padre eutiquio, nº 3775 - Condor",
  city: "Belém",
  state: "PA",
  cep: "66065-165",
  phone: "(91) 3235-9320",
  representativeName: "Guilherme de Oliveira Hessel",
  representativeRole: "Administrador Financeiro",
  representativeCpf: "431.501.768-08",
  representativeRg: "54.040.895-5",
  representativeMaritalStatus: "casado",
  representativeAddress: "São Paulo, SP",
} as const;

function pickInstituteField(
  value: string | null | undefined,
  fallback: string | undefined,
): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return fallback ?? "—";
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
  const useIghDefaults = BRAND.shortName === "IGH";
  const defaults = useIghDefaults ? IGH_INSTITUTE_DEFAULTS : null;

  const name = donor?.name?.trim() || BRAND.legalName || BRAND.shortName || "Instituto";
  const logradouro = pickInstituteField(donor?.address, defaults?.address);
  const city = pickInstituteField(donor?.city, defaults?.city);
  const state = pickInstituteField(donor?.state, defaults?.state);
  const cep = pickInstituteField(donor?.cep, defaults?.cep);
  const addr = [logradouro, city && state ? `${city}/${state}` : city || state, cep]
    .filter((part) => part && part !== "—")
    .join(", ");

  const instituto: Record<string, string> = {
    "instituto.nome": name,
    "instituto.cnpj": pickInstituteField(donor?.document, defaults?.document),
    "instituto.email": donor?.email?.trim() || "—",
    "instituto.logradouro": logradouro,
    "instituto.endereco": addr || "—",
    "instituto.cidade": city,
    "instituto.estado": state,
    "instituto.cep": cep,
    "instituto.telefone": pickInstituteField(donor?.phone, defaults?.phone),
    "instituto.responsavel": pickInstituteField(donor?.representativeName, defaults?.representativeName),
    "instituto.cargo": pickInstituteField(donor?.representativeRole, defaults?.representativeRole),
    "instituto.cpf": pickInstituteField(donor?.representativeCpf, defaults?.representativeCpf),
    "instituto.responsavel_rg": defaults?.representativeRg ?? "—",
    "instituto.responsavel_estado_civil": defaults?.representativeMaritalStatus ?? "—",
    "instituto.responsavel_endereco": defaults?.representativeAddress ?? "—",
  };
  const doadora = Object.fromEntries(
    Object.entries(instituto).map(([key, value]) => [key.replace("instituto.", "doadora."), value]),
  );
  return { ...instituto, ...doadora };
}

export { donorSelect };
