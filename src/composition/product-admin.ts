import "server-only";

import * as catalog from "@/modules/catalog/server";
import type { AdminProduct, PublicationIssue } from "@/modules/catalog/contracts";
import * as inventory from "@/modules/inventory/server";
import type { StockBalance, StockMovementView } from "@/modules/inventory/contracts";
import { getImagesByIds } from "@/modules/media/server";
import type { MediaImage } from "@/modules/media/contracts";

/**
 * Composición del editor de productos: catálogo (ficha), inventario (stock por variante)
 * y media (URLs). Ningún módulo lee tablas de otro; se cruzan aquí por ids.
 */
export type ProductEditorData = {
  product: AdminProduct;
  balances: Record<string, StockBalance>;
  movements: StockMovementView[];
  issues: PublicationIssue[];
};

export async function getProductEditorData(productId: string): Promise<ProductEditorData | null> {
  const product = await catalog.getAdminProduct(productId);
  if (!product) return null;
  const variantIds = product.variants.map((v) => v.id);
  const [balances, movements] = await Promise.all([inventory.getBalances(variantIds), inventory.getRecentMovements(variantIds, 40)]);
  const issues = await catalog.getPublicationIssues(product, new Set(balances.keys()));
  return { product, balances: Object.fromEntries(balances), movements, issues };
}

export type ProductListRow = Awaited<ReturnType<typeof catalog.listAdminProducts>>["items"][number] & {
  cover: MediaImage | null;
  stock: { onHand: number; available: number; unregistered: number };
};

export async function listProductsForAdmin(filter: Parameters<typeof catalog.listAdminProducts>[0]) {
  const { items, total } = await catalog.listAdminProducts(filter);
  const [balances, covers] = await Promise.all([
    inventory.getBalances(items.flatMap((i) => i.variantIds)),
    getImagesByIds(items.map((i) => i.coverMediaId).filter((id): id is string => Boolean(id))),
  ]);
  const rows: ProductListRow[] = items.map((item) => {
    const own = item.variantIds.map((id) => balances.get(id));
    return {
      ...item,
      cover: item.coverMediaId ? (covers.get(item.coverMediaId) ?? null) : null,
      stock: {
        onHand: own.reduce((sum, b) => sum + (b?.onHand ?? 0), 0),
        available: own.reduce((sum, b) => sum + (b?.available ?? 0), 0),
        unregistered: own.filter((b) => !b).length,
      },
    };
  });
  return { rows, total };
}
