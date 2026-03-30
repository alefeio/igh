/** IP e User-Agent a partir da requisição (útil atrás de proxy: x-forwarded-for). */
export function getRequestClientMeta(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  const ipAddress =
    firstForwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null;
  const rawUa = request.headers.get("user-agent");
  const userAgent = rawUa && rawUa.length > 2000 ? `${rawUa.slice(0, 2000)}…` : rawUa;
  return { ipAddress, userAgent };
}
