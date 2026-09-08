import { clientIpFromRequest } from "@/lib/bot-protection";
import { getSessionUserFromCookie } from "@/lib/auth";
import {
  REFERRER_SEARCH_MIN_LENGTH,
  searchReferrerCandidates,
} from "@/lib/holiday-event-referral";
import { jsonErr, jsonOk } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit-memory";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_IP = 60;

export async function GET(request: Request) {
  const ip = clientIpFromRequest(request);
  const limit = checkRateLimit(`holiday-referrer-search:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
  if (!limit.ok) {
    return jsonErr("RATE_LIMIT", `Muitas buscas. Aguarde ${limit.retryAfterSec} segundos.`, 429);
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < REFERRER_SEARCH_MIN_LENGTH) {
    return jsonOk({ candidates: [], minLength: REFERRER_SEARCH_MIN_LENGTH });
  }

  const session = await getSessionUserFromCookie();
  const candidates = await searchReferrerCandidates(q, session?.id ?? null);

  return jsonOk({ candidates, minLength: REFERRER_SEARCH_MIN_LENGTH });
}
