import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuthAdminGateway } from "../application/ports";

export { createSupabaseAdminClient } from "../../../infrastructure/supabase/admin-client";

class ProviderError extends Error {
  constructor(operation: string, cause: { message?: string; status?: number } | null) {
    // Sin datos personales: solo operación y mensaje del proveedor.
    super(`Supabase Auth (${operation}): ${cause?.message ?? "error desconocido"}`);
    this.name = "ProviderError";
  }
}

export function createSupabaseAuthAdminGateway(client: SupabaseClient): AuthAdminGateway {
  return {
    async inviteUser(email) {
      const { data, error } = await client.auth.admin.inviteUserByEmail(email);
      if (error || !data.user) throw new ProviderError("invite", error);
      return { subject: data.user.id };
    },
    async deleteUser(subject) {
      const { error } = await client.auth.admin.deleteUser(subject);
      if (error && error.status !== 404) throw new ProviderError("delete", error);
    },
    async hasVerifiedMfa(subject) {
      const { data, error } = await client.auth.admin.mfa.listFactors({ userId: subject });
      if (error) return null;
      return data.factors.some((factor) => factor.status === "verified");
    },
    async resetMfa(subject) {
      const { data, error } = await client.auth.admin.mfa.listFactors({ userId: subject });
      if (error) throw new ProviderError("mfa.list", error);
      for (const factor of data.factors) {
        const result = await client.auth.admin.mfa.deleteFactor({ userId: subject, id: factor.id });
        if (result.error) throw new ProviderError("mfa.delete", result.error);
      }
    },
  };
}
