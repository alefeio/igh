import type { AudienceRecipient } from "./audience";
import { renderSmsMessage, firstName, type PlaceholderData } from "./placeholders";
import { validatePhone } from "./phone";

export interface EligibleRecipient {
  recipientType: string;
  recipientId: string;
  recipientNameSnapshot: string;
  phoneSnapshot: string;
  phoneNormalized: string;
  renderedMessage: string;
}

/**
 * A partir da lista de destinatários da audiência, monta a lista elegível (com telefone válido, deduplicada)
 * e preenche a mensagem renderizada para cada um.
 */
export function buildEligibleRecipients(
  recipients: AudienceRecipient[],
  messageContent: string
): EligibleRecipient[] {
  const withPhone = recipients.filter((r) => r.phone != null && r.phone.trim() !== "");
  const validated = withPhone.map((r) => ({
    rec: r,
    result: validatePhone(r.phone!),
  }));
  const valid = validated.filter((v) => v.result.valid);
  const byNormalized = new Map<string, (typeof validated)[0]>();
  for (const v of valid) {
    const key = v.result.normalized;
    if (!byNormalized.has(key)) byNormalized.set(key, v);
  }

  const list: EligibleRecipient[] = [];
  for (const { rec, result } of byNormalized.values()) {
    const data: PlaceholderData = {
      nome: rec.name,
      primeiro_nome: firstName(rec.name),
      turma: rec.classGroupName ?? "",
      curso: rec.courseName ?? "",
      unidade: "N/A",
      link: "",
      data_inicio: "",
      horario: "",
      local: "",
      link_area_aluno: "",
      telefone_igh: "",
      email_suporte: "",
    };
    list.push({
      recipientType: rec.recipientType,
      recipientId: rec.recipientId,
      recipientNameSnapshot: rec.name,
      phoneSnapshot: result.original,
      phoneNormalized: result.normalized,
      renderedMessage: renderSmsMessage(messageContent, data),
    });
  }
  return list;
}
