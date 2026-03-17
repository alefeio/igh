import type { EmailAudienceRecipient } from "./audience";
import { validateEmail } from "./email";
import {
  firstName,
  renderSubject,
  renderHtmlContent,
  renderTextContent,
  type PlaceholderData,
} from "./placeholders";

export interface EligibleEmailRecipient {
  recipientType: string;
  recipientId: string;
  recipientNameSnapshot: string;
  emailSnapshot: string;
  emailNormalized: string;
  renderedSubject: string;
  renderedHtmlContent: string | null;
  renderedTextContent: string | null;
}

/**
 * A partir da lista de destinatários da audiência, monta a lista elegível (com e-mail válido, deduplicada)
 * e preenche assunto e conteúdo renderizados para cada um.
 */
export function buildEligibleEmailRecipients(
  recipients: EmailAudienceRecipient[],
  subject: string,
  htmlContent: string | null,
  textContent: string | null
): EligibleEmailRecipient[] {
  const withEmail = recipients.filter(
    (r) => r.email != null && r.email.trim() !== ""
  );
  const validated = withEmail.map((r) => ({
    rec: r,
    result: validateEmail(r.email!),
  }));
  const valid = validated.filter((v) => v.result.valid);
  const byNormalized = new Map<string, (typeof validated)[0]>();
  for (const v of valid) {
    const key = v.result.normalized;
    if (!byNormalized.has(key)) byNormalized.set(key, v);
  }

  const list: EligibleEmailRecipient[] = [];
  for (const { rec, result } of byNormalized.values()) {
    const data: PlaceholderData = {
      nome: rec.name,
      primeiro_nome: firstName(rec.name),
      turma: rec.classGroupName ?? "",
      curso: rec.courseName ?? "",
      unidade: "N/A",
      link: "",
    };
    list.push({
      recipientType: rec.recipientType,
      recipientId: rec.recipientId,
      recipientNameSnapshot: rec.name,
      emailSnapshot: result.original,
      emailNormalized: result.normalized,
      renderedSubject: renderSubject(subject, data),
      renderedHtmlContent:
        htmlContent != null && htmlContent.trim() !== ""
          ? renderHtmlContent(htmlContent, data)
          : null,
      renderedTextContent:
        textContent != null && textContent.trim() !== ""
          ? renderTextContent(textContent, data)
          : null,
    });
  }
  return list;
}
