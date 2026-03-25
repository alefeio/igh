/** Rate limit em memória (adequado a instância única; em cluster usar Redis etc.). */

type Bucket = { count: number; windowStart: number };

const store = new Map<string, Bucket>();

const MAX_KEYS = 5000;

function pruneIfNeeded() {
  if (store.size <= MAX_KEYS) return;
  const cutoff = Date.now() - 3600_000;
  for (const [k, v] of store) {
    if (v.windowStart < cutoff) store.delete(k);
  }
}

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  pruneIfNeeded();
  const now = Date.now();
  let b = store.get(key);
  if (!b || now - b.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (b.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - b.windowStart)) / 1000));
    return { ok: false, retryAfterSec };
  }
  b.count += 1;
  return { ok: true };
}
