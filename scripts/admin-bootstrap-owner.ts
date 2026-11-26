/**
 * Alta controlada del primer propietario. Solo funciona si no existe ningún propietario
 * activo o invitado; después, los accesos se gestionan desde /admin/acceso.
 *
 *   npm run admin:bootstrap-owner -- --email persona@dominio --name "Nombre"
 */
import { bootstrapFirstOwner } from "../src/modules/identity/application/access-management";
import { createScriptIdentityDeps, readArg } from "./lib/identity-deps";

async function main() {
  const email = readArg("email");
  const name = readArg("name");
  if (!email || !name) throw new Error('Uso: npm run admin:bootstrap-owner -- --email correo --name "Nombre"');

  const { deps, close } = createScriptIdentityDeps();
  try {
    const result = await bootstrapFirstOwner(deps, { email, displayName: name });
    if (!result.ok) throw new Error(result.message);
    console.log("✓ Propietario invitado. Debe abrir el enlace del correo, crear su contraseña y activar MFA.");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
