import "server-only";

import { prisma } from "@/lib/prisma";

export type CertificateIssuePlace = {
  /** Cidade no verso (ex.: "Brasília"). */
  city: string;
  /** Local na frente (ex.: "Brasília/DF"). */
  cityState: string;
};

function composeCityState(city: string, state: string): string {
  const c = city.trim();
  const s = state.trim();
  if (c && s) return `${c}/${s}`;
  return c || s || "";
}

/**
 * Resolve a cidade impressa no certificado da matrícula.
 * Ordem: local do polo da turma → Configurações do site → env → vazio.
 */
export async function resolveCertificateIssuePlace(
  enrollmentId: string,
): Promise<CertificateIssuePlace> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      classGroup: {
        select: {
          poloLocation: { select: { city: true, state: true } },
        },
      },
    },
  });

  const locCity = enrollment?.classGroup.poloLocation?.city?.trim() ?? "";
  const locState = enrollment?.classGroup.poloLocation?.state?.trim() ?? "";
  if (locCity || locState) {
    return { city: locCity, cityState: composeCityState(locCity, locState) };
  }

  const settings = await prisma.siteSettings.findFirst({
    select: { certificateCity: true, certificateCityState: true },
  });
  const settingsCity = settings?.certificateCity?.trim() ?? "";
  const settingsUf = settings?.certificateCityState?.trim() ?? "";
  if (settingsCity || settingsUf) {
    return {
      city: settingsCity,
      cityState: composeCityState(settingsCity, settingsUf),
    };
  }

  const envCity = process.env.CERTIFICATE_CITY?.trim() ?? "";
  const envCityState = process.env.CERTIFICATE_CITY_STATE?.trim() ?? "";
  if (envCity || envCityState) {
    return {
      city: envCity,
      cityState: envCityState || composeCityState(envCity, ""),
    };
  }

  return { city: "", cityState: "" };
}

/** Monta "Cidade, 27 de Julho de 2026" ou só a data se a cidade estiver vazia. */
export function formatCertificatePlaceDate(place: string, dateLabel: string): string {
  const p = place.trim();
  return p ? `${p}, ${dateLabel}` : dateLabel;
}
