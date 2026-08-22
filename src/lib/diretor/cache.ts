import "server-only";

/**
 * Cache por domínio. Chaves incluem todos os filtros relevantes.
 * Fora do runtime Next (testes), executa sem cache.
 */
export async function cachedDirector<T>(
  keyParts: Array<string | number | boolean | null | undefined>,
  fn: () => Promise<T>,
  ttlSeconds = 90,
): Promise<T> {
  const key = ["diretor-1b", ...keyParts.map((p) => String(p ?? ""))].join(":");
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(fn, [key], { revalidate: ttlSeconds })();
  } catch {
    return fn();
  }
}
