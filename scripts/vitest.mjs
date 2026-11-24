// Lanza Vitest con la letra de unidad en mayúscula en Windows.
// Con `c:\...` (habitual en la terminal de VS Code) Node carga dos instancias de Vitest
// (`c:/` y `C:/`) y las pruebas fallan con "Cannot read properties of undefined (reading 'config')".
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd =
  process.platform === "win32" && /^[a-z]:/.test(process.cwd())
    ? process.cwd()[0].toUpperCase() + process.cwd().slice(1)
    : process.cwd();

const vitestBin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
