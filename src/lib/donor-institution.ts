import "server-only";

import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";

import type { DonorInstitutionView } from "@/lib/donor-institution-ui";

export type { DonorInstitutionView };

export async function getOrCreateDonorInstitutionSettings(actorId?: string | null) {
  const existing = await prisma.donorInstitutionSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  return prisma.donorInstitutionSettings.create({
    data: {
      name: BRAND.legalName,
      updatedByUserId: actorId ?? null,
    },
  });
}

export function serializeDonorInstitution(
  row: Awaited<ReturnType<typeof getOrCreateDonorInstitutionSettings>>,
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
    updatedAt: row.updatedAt.toISOString(),
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

  return {
    "instituto.nome": name,
    "instituto.cnpj": donor?.document?.trim() || "—",
    "instituto.email": donor?.email?.trim() || "—",
    "instituto.endereco": addr || "—",
    "instituto.cidade": donor?.city?.trim() || "—",
    "instituto.estado": donor?.state?.trim() || "—",
    "instituto.cep": donor?.cep?.trim() || "—",
    "instituto.telefone": donor?.phone?.trim() || "—",
    "instituto.responsavel": donor?.representativeName?.trim() || "—",
    "instituto.cargo": donor?.representativeRole?.trim() || "—",
    "instituto.cpf": donor?.representativeCpf?.trim() || "—",
  };
}
