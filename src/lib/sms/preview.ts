import type { AudienceRecipient } from "./audience";
import { validatePhone } from "./phone";

export interface SmsPreviewResult {
  totalFound: number;
  totalWithPhone: number;
  totalValid: number;
  totalMissingPhone: number;
  totalInvalidPhone: number;
  totalDuplicatesRemoved: number;
  totalEligible: number;
}

/**
 * Calcula totais da prévia: encontrados, com telefone, válidos, sem telefone, inválidos, duplicados removidos, elegíveis.
 * Deduplicação por telefone normalizado.
 */
export function previewSmsCampaign(recipients: AudienceRecipient[]): SmsPreviewResult {
  const totalFound = recipients.length;
  const withPhone = recipients.filter((r) => r.phone != null && r.phone.trim() !== "");
  const totalWithPhone = withPhone.length;
  const totalMissingPhone = totalFound - totalWithPhone;

  const validated = withPhone.map((r) => ({
    ...r,
    result: validatePhone(r.phone!),
  }));
  const valid = validated.filter((v) => v.result.valid);
  const totalInvalidPhone = validated.length - valid.length;

  const byNormalized = new Map<string, (typeof valid)[0]>();
  for (const v of valid) {
    const key = v.result.normalized;
    if (!byNormalized.has(key)) byNormalized.set(key, v);
  }
  const totalDuplicatesRemoved = valid.length - byNormalized.size;
  const totalEligible = byNormalized.size;

  return {
    totalFound,
    totalWithPhone,
    totalValid: valid.length,
    totalMissingPhone,
    totalInvalidPhone,
    totalDuplicatesRemoved,
    totalEligible,
  };
}
