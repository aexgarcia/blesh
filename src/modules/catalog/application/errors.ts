import type { CatalogErrorCode, PublicationIssue } from "../contracts";

export class CatalogFailure extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    message: string,
    readonly field?: string,
    readonly issues?: PublicationIssue[],
  ) {
    super(message);
    this.name = "CatalogFailure";
  }
}

export type CatalogResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CatalogErrorCode; message: string; field?: string; issues?: PublicationIssue[] };

export async function catalogResult<T>(run: () => Promise<T>): Promise<CatalogResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof CatalogFailure) {
      return { ok: false, code: error.code, message: error.message, field: error.field, issues: error.issues };
    }
    throw error;
  }
}
