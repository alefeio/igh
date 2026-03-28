/** Utilitários partilhados (cliente + servidor) para comparar aceites com versões publicadas. */

export type LegalVersionRef = { id: string };

export type PublishedBundle = {
  terms: LegalVersionRef | null;
  privacy: LegalVersionRef | null;
  cookie: LegalVersionRef | null;
};

export type StoredAcceptance = {
  termsVersionId: string | null;
  privacyVersionId: string | null;
  cookieVersionId: string | null;
};

/** true = o visitante já aceitou todas as versões publicadas atualmente. */
export function legalAcceptanceMatches(current: PublishedBundle, stored: StoredAcceptance | null): boolean {
  if (!stored) return false;
  if (current.terms) {
    if (stored.termsVersionId !== current.terms.id) return false;
  }
  if (current.privacy) {
    if (stored.privacyVersionId !== current.privacy.id) return false;
  }
  if (current.cookie) {
    if (stored.cookieVersionId !== current.cookie.id) return false;
  }
  return true;
}

/** Há algum documento publicado que exija manifestação? */
export function hasAnyPublishedLegal(current: PublishedBundle): boolean {
  return !!(current.terms || current.privacy || current.cookie);
}

/** Só termos e privacidade (área logada / painel). */
export type TermsPrivacyBundle = {
  terms: LegalVersionRef | null;
  privacy: LegalVersionRef | null;
};

export type StoredTermsPrivacy = {
  termsVersionId: string | null;
  privacyVersionId: string | null;
};

export function hasTermsOrPrivacyPublished(current: TermsPrivacyBundle): boolean {
  return !!(current.terms || current.privacy);
}

/** Compara apenas termos + privacidade (ignora cookies). */
export function legalTermsPrivacyMatches(current: TermsPrivacyBundle, stored: StoredTermsPrivacy | null): boolean {
  if (!stored) return false;
  if (current.terms) {
    if (stored.termsVersionId !== current.terms.id) return false;
  }
  if (current.privacy) {
    if (stored.privacyVersionId !== current.privacy.id) return false;
  }
  return true;
}
