/** Limita concorrência de promises (pool Prisma). */
export async function mapSettledLimit(
  items: Array<{ label: string; run: () => Promise<unknown> }>,
  limit = 2,
): Promise<Array<{ label: string; ok: true; value: unknown } | { label: string; ok: false; error: string }>> {
  const out: Array<{ label: string; ok: true; value: unknown } | { label: string; ok: false; error: string }> = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      const item = items[idx];
      try {
        const value = await item.run();
        out[idx] = { label: item.label, ok: true, value };
      } catch (e) {
        console.error(`[diretor/settled] ${item.label}`, e);
        out[idx] = { label: item.label, ok: false, error: `Falha no domínio ${item.label}.` };
      }
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}
