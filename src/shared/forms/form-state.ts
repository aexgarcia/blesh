/** Estado serializable que devuelven las Server Actions a los formularios. */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const idleState: FormState = { status: "idle" };

export function errorState(message: string, fieldErrors?: Record<string, string>): FormState {
  return { status: "error", message, fieldErrors };
}

/** Primer mensaje por campo a partir de un error de Zod. */
export function fieldErrorsFrom(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

/** Solo rutas internas de administración para evitar redirecciones abiertas. */
export function safeAdminPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/admin/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
