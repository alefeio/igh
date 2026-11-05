/**
 * Executa um comando com o Prisma apontando só para o Postgres Docker local.
 */
import { spawn } from "node:child_process";
import { buildDevDatabaseUrl, devDatabaseEnv, printDevDatabaseConfirmation } from "./dev-database-lib.mjs";

const command = process.argv.slice(2).join(" ").trim();
if (!command) {
  console.error("Uso: node scripts/with-dev-database.mjs <comando>");
  process.exit(2);
}

const url = buildDevDatabaseUrl();
printDevDatabaseConfirmation(url);
const child = spawn(command, {
  env: devDatabaseEnv(url),
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});
child.on("exit", (code) => process.exit(code ?? 1));
