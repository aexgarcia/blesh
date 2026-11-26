/**
 * Packs por cantidad (ADR-020): política limitada y versionada, calculada SOLO en el servidor
 * sobre los SKU constituyentes. Sin stock de "pack": cada prenda descuenta su propia variante.
 * Puro y sin I/O; dinero en céntimos.
 */

export type PackPolicy = {
  /** Código estable; la revisión guarda `code@version`. */
  code: string;
  version: number;
  label: string;
  /** Variantes elegibles: las de productos de esta categoría. */
  categorySlug: string;
  /** Cuando se configura desde el panel, estos productos sustituyen al filtro por categoría. */
  productSlugs?: readonly string[];
  /** Precio total por 1, 2 y 3 unidades. Más de 3: grupos de 3 + resto. */
  tierTotalsMinor: readonly [number, number, number];
};

/** Pack Boxy Essential del prototipo: 1 × S/40 · 2 × S/75 · 3 × S/99. */
export const PACK_POLICIES: readonly PackPolicy[] = [
  { code: "pack-boxy-essential", version: 1, label: "Pack Boxy Essential", categorySlug: "boxy-essential", tierTotalsMinor: [4000, 7500, 9900] },
];

export type PromotionLine = { categorySlug: string | null; productSlug?: string; unitPriceMinor: number; quantity: number };

export function packApplies(policy: PackPolicy, item: { categorySlug: string | null; productSlug?: string }): boolean {
  return policy.productSlugs ? Boolean(item.productSlug && policy.productSlugs.includes(item.productSlug)) : item.categorySlug === policy.categorySlug;
}

export type AppliedPromotion = {
  code: string;
  version: number;
  label: string;
  units: number;
  /** Precio normal de las unidades elegibles y precio con pack. */
  listMinor: number;
  packMinor: number;
  discountMinor: number;
};

export type PromotionResult = { discountMinor: number; applied: AppliedPromotion[] };

export const NO_PROMOTION: PromotionResult = { discountMinor: 0, applied: [] };

/** Total del pack para `units` prendas: grupos de 3 al precio de 3 y el resto a su escala. */
export function packTotalMinor(policy: PackPolicy, units: number): number {
  if (!Number.isSafeInteger(units) || units < 0) throw new RangeError(`Unidades inválidas: ${units}`);
  const [one, two, three] = policy.tierTotalsMinor;
  const rest = units % 3;
  return Math.floor(units / 3) * three + (rest === 1 ? one : rest === 2 ? two : 0);
}

/**
 * Descuento por packs sobre las líneas. Nunca negativo: si el precio normal ya es menor que
 * el del pack (p. ej. una rebaja), no se aplica nada.
 */
export function computePromotions(lines: readonly PromotionLine[], policies: readonly PackPolicy[] = PACK_POLICIES): PromotionResult {
  const applied: AppliedPromotion[] = [];
  // Cada línea entra como mucho en un pack (el primero que la acepte): sin descuentos acumulados.
  const claimed = new Set<PromotionLine>();
  for (const policy of policies) {
    const eligible = lines.filter((l) => !claimed.has(l) && packApplies(policy, l) && l.quantity > 0);
    for (const l of eligible) claimed.add(l);
    const units = eligible.reduce((sum, l) => sum + l.quantity, 0);
    if (units === 0) continue;
    const listMinor = eligible.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);
    const packMinor = packTotalMinor(policy, units);
    const discountMinor = Math.max(0, listMinor - packMinor);
    if (discountMinor > 0) applied.push({ code: policy.code, version: policy.version, label: policy.label, units, listMinor, packMinor, discountMinor });
  }
  return { discountMinor: applied.reduce((sum, a) => sum + a.discountMinor, 0), applied };
}

/** Texto guardado en la revisión: `pack-boxy-essential@1` (varias separadas por coma). */
export function promotionCode(result: PromotionResult): string | null {
  return result.applied.length ? result.applied.map((a) => `${a.code}@${a.version}`).join(",") : null;
}

/** Etiqueta legible para la revisión/mensaje. */
export function promotionLabel(result: PromotionResult): string | null {
  return result.applied.length ? result.applied.map((a) => a.label).join(", ") : null;
}

/** Etiqueta legible desde el código guardado en la revisión (`code@version`). */
export function promotionLabelFromCode(code: string | null, policies: readonly PackPolicy[] = PACK_POLICIES): string | null {
  if (!code) return null;
  return code
    .split(",")
    .map((entry) => {
      const [c, v] = entry.split("@");
      return policies.find((p) => p.code === c && String(p.version) === v)?.label ?? "Pack";
    })
    .join(", ");
}
