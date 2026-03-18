export { normalizeEmail, validateEmail } from "./email";
export type { EmailResult } from "./email";
export {
  renderSubject,
  renderHtmlContent,
  renderTextContent,
  firstName,
} from "./placeholders";
export type { PlaceholderData } from "./placeholders";
export { resolveEmailAudience } from "./audience";
export type { EmailAudienceRecipient, EmailAudienceFilters } from "./audience";
export { previewEmailCampaign } from "./preview";
export type { EmailPreviewResult } from "./preview";
export { buildEligibleEmailRecipients } from "./eligible";
export type { EligibleEmailRecipient } from "./eligible";
export {
  createEmailCampaign,
  updateEmailCampaign,
  getEmailCampaignPreview,
  confirmEmailCampaign,
  cancelEmailCampaign,
  duplicateEmailCampaign,
  requeueFailedEmailCampaignRecipients,
  requeueEmailCampaignRecipient,
  listEmailCampaigns,
  getEmailCampaignDetails,
  recalculateEmailCampaignTotals,
  updateEmailCampaignCountsOnly,
} from "./campaign";
export type {
  CreateEmailCampaignInput,
  UpdateEmailCampaignInput,
} from "./campaign";
export { getEmailProvider } from "./provider";
export type {
  EmailProvider,
  EmailSendResult,
  EmailSendParams,
} from "./provider";
export {
  processEmailCampaignBatch,
  startDueScheduledEmailCampaigns,
} from "./process";
export type { ProcessEmailBatchResult } from "./process";
export {
  listEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  toggleEmailTemplateActive,
  renderEmailTemplate,
  getSamplePlaceholderData,
} from "./templates";
export { handleResendWebhookEvent } from "./webhook";
export type { ResendWebhookPayload } from "./webhook";
