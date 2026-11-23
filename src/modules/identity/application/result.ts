import type { IdentityErrorCode } from "../contracts";
import { IdentityRuleError } from "../domain/membership";

export type Result<T = void> = { ok: true; value: T } | { ok: false; code: IdentityErrorCode; message: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (code: IdentityErrorCode, message: string): Result<never> => ({ ok: false, code, message });

/** Error de aplicación que interrumpe una transacción y se traduce a `Result`. */
export class IdentityFailure extends Error {
  constructor(
    readonly code: IdentityErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Convierte errores de reglas conocidos en `Result`; los inesperados se propagan. */
export async function toResult<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await run());
  } catch (error) {
    if (error instanceof IdentityFailure || error instanceof IdentityRuleError) {
      return fail(error.code, error.message);
    }
    throw error;
  }
}
