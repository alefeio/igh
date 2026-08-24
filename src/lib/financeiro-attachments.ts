export const MAX_FINANCIAL_ATTACHMENTS = 10;

export type FinancialAttachmentInput = {
  url: string;
  publicId?: string | null;
  fileName?: string | null;
  description: string;
};

export type FinancialAttachmentView = {
  id: string;
  url: string;
  publicId: string | null;
  fileName: string | null;
  description: string;
};

export function mergeFinancialAttachments(
  children: Array<{
    id: string;
    url: string;
    publicId: string | null;
    fileName: string | null;
    description: string;
  }>,
  legacy: {
    attachmentUrl: string | null;
    attachmentPublicId: string | null;
    attachmentFileName: string | null;
  },
): FinancialAttachmentView[] {
  if (children.length > 0) {
    return children.map((a) => ({
      id: a.id,
      url: a.url,
      publicId: a.publicId,
      fileName: a.fileName,
      description: a.description.trim() || a.fileName?.trim() || "Anexo",
    }));
  }
  if (legacy.attachmentUrl) {
    return [
      {
        id: "legacy",
        url: legacy.attachmentUrl,
        publicId: legacy.attachmentPublicId,
        fileName: legacy.attachmentFileName,
        description: legacy.attachmentFileName?.trim() || "Anexo",
      },
    ];
  }
  return [];
}

export function primaryAttachmentFields(items: FinancialAttachmentInput[]) {
  const first = items[0];
  return {
    attachmentUrl: first?.url ?? null,
    attachmentPublicId: first?.publicId ?? null,
    attachmentFileName: first?.fileName ?? null,
  };
}

export function normalizeFinancialAttachmentInputs(
  attachments: FinancialAttachmentInput[] | undefined,
  legacy: {
    attachmentUrl?: string | null;
    attachmentPublicId?: string | null;
    attachmentFileName?: string | null;
  },
): FinancialAttachmentInput[] {
  if (attachments && attachments.length > 0) {
    return attachments.slice(0, MAX_FINANCIAL_ATTACHMENTS).map((a) => ({
      url: a.url,
      publicId: a.publicId ?? null,
      fileName: a.fileName ?? null,
      description: a.description.trim() || a.fileName?.trim() || "Anexo",
    }));
  }
  if (legacy.attachmentUrl) {
    return [
      {
        url: legacy.attachmentUrl,
        publicId: legacy.attachmentPublicId ?? null,
        fileName: legacy.attachmentFileName ?? null,
        description: legacy.attachmentFileName?.trim() || "Anexo",
      },
    ];
  }
  return [];
}
