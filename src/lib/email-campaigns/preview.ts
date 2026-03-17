import type { EmailAudienceRecipient } from "./audience";
import { validateEmail } from "./email";

export interface EmailPreviewResult {
  totalFound: number;
  totalWithEmail: number;
  totalValid: number;
  totalMissingEmail: number;
  totalInvalidEmail: number;
  totalDuplicatesRemoved: number;
  totalEligible: number;
}

/**
 * Calcula totais da prévia: encontrados, com e-mail, válidos, sem e-mail, inválidos, duplicados removidos, elegíveis.
 * Deduplicação por e-mail normalizado.
 */
export function previewEmailCampaign(
  recipients: EmailAudienceRecipient[]
): EmailPreviewResult {
  const totalFound = recipients.length;
  const withEmail = recipients.filter(
    (r) => r.email != null && r.email.trim() !== ""
  );
  const totalWithEmail = withEmail.length;
  const totalMissingEmail = totalFound - totalWithEmail;

  const validated = withEmail.map((r) => ({
    ...r,
    result: validateEmail(r.email!),
  }));
  const valid = validated.filter((v) => v.result.valid);
  const totalInvalidEmail = validated.length - valid.length;

  const byNormalized = new Map<string, (typeof valid)[0]>();
  for (const v of valid) {
    const key = v.result.normalized;
    if (!byNormalized.has(key)) byNormalized.set(key, v);
  }
  const totalDuplicatesRemoved = valid.length - byNormalized.size;
  const totalEligible = byNormalized.size;

  return {
    totalFound,
    totalWithEmail,
    totalValid: valid.length,
    totalMissingEmail,
    totalInvalidEmail,
    totalDuplicatesRemoved,
    totalEligible,
  };
}
