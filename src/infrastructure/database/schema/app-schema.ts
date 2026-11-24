import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Esquema privado de la aplicación. No se usa `public` para que la Data API
 * del proveedor (p. ej. Supabase/PostgREST) no exponga tablas comerciales.
 */
export const appSchema = pgSchema("app");
