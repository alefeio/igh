import "server-only";

import type { LegalDocumentKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type PublishedLegalVersion = {
  id: string;
  kind: LegalDocumentKind;
  versionLabel: string;
  title: string;
  contentRich: string;
  publishedAt: string;
};

/** Versão publicada atual por tipo (no máximo uma PUBLISHED por kind). */
export async function getPublishedLegalVersion(kind: LegalDocumentKind): Promise<PublishedLegalVersion | null> {
  const row = await prisma.legalDocumentVersion.findFirst({
    where: { kind, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      kind: true,
      versionLabel: true,
      title: true,
      contentRich: true,
      publishedAt: true,
    },
  });
  if (!row?.publishedAt) return null;
  return {
    ...row,
    publishedAt: row.publishedAt.toISOString(),
  };
}

export async function getPublishedLegalBundle(): Promise<{
  terms: PublishedLegalVersion | null;
  privacy: PublishedLegalVersion | null;
  cookie: PublishedLegalVersion | null;
}> {
  const [terms, privacy, cookie] = await Promise.all([
    getPublishedLegalVersion("TERMS"),
    getPublishedLegalVersion("PRIVACY"),
    getPublishedLegalVersion("COOKIE_POLICY"),
  ]);
  return { terms, privacy, cookie };
}
