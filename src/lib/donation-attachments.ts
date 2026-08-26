export const MAX_DONATION_ATTACHMENTS = 10;

export type DonationAttachmentKindValue = "GERADO" | "ASSINADO" | "OUTRO";

export type DonationAttachmentInput = {
  url: string;
  publicId?: string | null;
  fileName?: string | null;
  description: string;
  kind?: DonationAttachmentKindValue;
};

export type DonationAttachmentView = {
  id: string;
  url: string;
  publicId: string | null;
  fileName: string | null;
  description: string;
  kind: DonationAttachmentKindValue;
  createdAt: string;
};

export const DONATION_ATTACHMENT_KIND_LABEL: Record<DonationAttachmentKindValue, string> = {
  GERADO: "PDF gerado",
  ASSINADO: "Termo assinado",
  OUTRO: "Anexo",
};

export function normalizeDonationAttachmentInputs(
  attachments: DonationAttachmentInput[] | undefined,
): DonationAttachmentInput[] {
  if (!attachments || attachments.length === 0) return [];
  return attachments.slice(0, MAX_DONATION_ATTACHMENTS).map((a) => ({
    url: a.url,
    publicId: a.publicId ?? null,
    fileName: a.fileName ?? null,
    description:
      a.description.trim() ||
      a.fileName?.trim() ||
      DONATION_ATTACHMENT_KIND_LABEL[a.kind ?? "OUTRO"],
    kind: a.kind ?? "OUTRO",
  }));
}

/** Preferência para visualizar/baixar: GERADO → pdfUrl legado → primeiro ASSINADO → primeiro anexo. */
export function resolveDonationPdfUrl(opts: {
  pdfUrl: string | null;
  attachments: Array<{ url: string; kind: DonationAttachmentKindValue }>;
}): string | null {
  const generated = opts.attachments.find((a) => a.kind === "GERADO");
  if (generated?.url) return generated.url;
  if (opts.pdfUrl) return opts.pdfUrl;
  const signed = opts.attachments.find((a) => a.kind === "ASSINADO");
  if (signed?.url) return signed.url;
  return opts.attachments[0]?.url ?? null;
}
