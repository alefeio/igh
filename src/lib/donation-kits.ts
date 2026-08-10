/** Composição padrão do kit "Computadores para Inclusão" (referência igh-termos). */
export const DEFAULT_DONATION_KIT = [
  { name: "CPU", quantityPerKit: 1 },
  { name: "Monitor", quantityPerKit: 1 },
  { name: "Teclado", quantityPerKit: 1 },
  { name: "Mouse", quantityPerKit: 1 },
  { name: "Cabo de Força", quantityPerKit: 2 },
  { name: "Cabo de Vídeo", quantityPerKit: 1 },
] as const;

export type DonationKitComponent = {
  name: string;
  quantityPerKit: number;
};

export function describeDonationKit(components: readonly DonationKitComponent[] = DEFAULT_DONATION_KIT): string {
  return components.map((c) => `${c.quantityPerKit} ${c.name}`).join(", ");
}

/** Expande kits em linhas de itens (sem vínculo de estoque). */
export function expandDonationKitItems(
  kitsCount: number,
  components: readonly DonationKitComponent[] = DEFAULT_DONATION_KIT,
): Array<{ name: string; quantity: number; unit: string }> {
  if (kitsCount <= 0) return [];
  return components.map((c) => ({
    name: c.name,
    quantity: c.quantityPerKit * kitsCount,
    unit: "UN",
  }));
}

/**
 * Une itens de kit com extras: se o nome coincidir, soma quantidades.
 * Extras com inventoryItemId preservam o vínculo.
 */
export function mergeDonationItems(
  kitItems: Array<{ name: string; quantity: number; unit: string; inventoryItemId?: string | null }>,
  extras: Array<{ name: string; quantity: number; unit: string; inventoryItemId?: string | null }>,
) {
  const map = new Map<
    string,
    { name: string; quantity: number; unit: string; inventoryItemId: string | null }
  >();

  for (const item of [...kitItems, ...extras]) {
    const key = item.inventoryItemId
      ? `id:${item.inventoryItemId}`
      : `name:${item.name.trim().toLowerCase()}`;
    const prev = map.get(key);
    if (prev) {
      prev.quantity += item.quantity;
    } else {
      map.set(key, {
        name: item.name.trim(),
        quantity: item.quantity,
        unit: item.unit || "UN",
        inventoryItemId: item.inventoryItemId ?? null,
      });
    }
  }

  return Array.from(map.values());
}
