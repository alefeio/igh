export type { PlaceholderData } from "@/lib/sms/placeholders";
export { firstName, renderSmsMessage } from "@/lib/sms/placeholders";

import { renderSmsMessage, type PlaceholderData } from "@/lib/sms/placeholders";

/**
 * Aplica placeholders no assunto.
 */
export function renderSubject(template: string, data: PlaceholderData): string {
  return renderSmsMessage(template, data);
}

/**
 * Aplica placeholders no conteúdo HTML.
 */
export function renderHtmlContent(template: string, data: PlaceholderData): string {
  return renderSmsMessage(template, data);
}

/**
 * Aplica placeholders no conteúdo texto.
 */
export function renderTextContent(template: string, data: PlaceholderData): string {
  return renderSmsMessage(template, data);
}
