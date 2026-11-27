import { randomUUID } from "node:crypto";

/** No recibe error/SQL/entrada: evita registrar params de Drizzle con datos de contacto. */
export function reportPublicFailure(operation: "store.quote" | "store.request") {
  const requestId = randomUUID();
  console.error(JSON.stringify({ level: "error", event: "public_operation_failed", operation, requestId }));
  return requestId;
}
