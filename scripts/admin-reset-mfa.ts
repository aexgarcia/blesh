/**
 * Procedimiento de emergencia: restablece la verificación en dos pasos de un usuario
 * cuando ningún propietario puede hacerlo desde /admin/acceso. Verificar la identidad
 * de la persona por otro medio ANTES de ejecutarlo. Queda auditado como `system`.
 *
 *   npm run admin:reset-mfa -- --email persona@dominio --reason "Motivo detallado"
 */
import { emergencyResetMfa } from "../src/modules/identity/application/access-management";
import { createScriptIdentityDeps, readArg } from "./lib/identity-deps";

async function main() {
  const email = readArg("email");
  const reason = readArg("reason");
  if (!email || !reason) throw new Error('Uso: npm run admin:reset-mfa -- --email correo --reason "Motivo"');

  const { deps, close } = createScriptIdentityDeps();
  try {
    const result = await emergencyResetMfa(deps, { email, reason });
    if (!result.ok) throw new Error(result.message);
    console.log("✓ Verificación restablecida y sesiones revocadas. Deberá configurar una nueva app al iniciar sesión.");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
