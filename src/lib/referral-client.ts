/** Constantes de indicação seguras para Client Components. */

export const REFERRAL_COOKIE_NAME = "referral_code";
export const REFERRAL_STORAGE_KEY = "referral_code";
export const REFERRAL_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;

export const STUDENT_REFERRAL_POINTS = {
  registration: 50,
  firstAttendance: 100,
  subsequentAttendance: 5,
  certification: 200,
} as const;

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toLowerCase();
  if (!code || code.length < 4 || code.length > 32) return null;
  if (!/^[a-z0-9_-]+$/.test(code)) return null;
  return code;
}

/** Persiste o código no cookie e no localStorage (browser). */
export function persistReferralCode(raw: string): string | null {
  const code = normalizeReferralCode(raw);
  if (!code || typeof document === "undefined") return null;
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    /* private mode */
  }
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; Path=/; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  return code;
}

export function readStoredReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const fromLs = normalizeReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY));
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE_NAME}=([^;]*)`));
  return normalizeReferralCode(match ? decodeURIComponent(match[1]) : null);
}
