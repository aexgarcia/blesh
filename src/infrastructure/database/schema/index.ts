/**
 * Registro global de esquemas para Drizzle (cliente y drizzle-kit).
 * Cada módulo define sus tablas en su propia capa `infrastructure` y se registra aquí
 * cuando se implementa; no crear tablas de módulos todavía no desarrollados.
 */
export { appSchema } from "./app-schema";
export { auditEvents } from "./audit";
export { idempotencyRecords } from "./idempotency";
export { adminMemberships } from "../../../modules/identity/infrastructure/schema";
export { mediaAssets } from "../../../modules/media/infrastructure/schema";
export {
  categories,
  productColors,
  productImages,
  products,
  productVariants,
  sizeGuideRows,
  sizeGuides,
} from "../../../modules/catalog/infrastructure/schema";
export { inventoryBalances, stockMovements } from "../../../modules/inventory/infrastructure/schema";
