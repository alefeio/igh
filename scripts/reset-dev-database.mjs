/**
 * Apaga só o volume Docker local igh_dev. Exige DEV_DB_RESET_CONFIRM=yes.
 */
import { spawnSync } from "node:child_process";
import { buildDevDatabaseUrl, printDevDatabaseConfirmation } from "./dev-database-lib.mjs";

if (process.env.DEV_DB_RESET_CONFIRM !== "yes") {
  console.error("Recusado. Para apagar só o volume local: DEV_DB_RESET_CONFIRM=yes npm run db:dev:reset");
  process.exit(1);
}

const url = buildDevDatabaseUrl();
printDevDatabaseConfirmation(url);

function run(command) {
  return spawnSync(command, { shell: true, stdio: "inherit" });
}

const down = run("docker compose -f docker-compose.dev.yml down");
if (down.status !== 0) process.exit(down.status || 1);

const listed = spawnSync("docker volume ls -q", { shell: true, encoding: "utf8" });
if (listed.status !== 0) process.exit(listed.status || 1);
const volumes = (listed.stdout || "").split(/\r?\n/).filter((name) => name.endsWith("igh_dev_pgdata"));
if (volumes.length === 0) {
  console.log("Nenhum volume igh_dev_pgdata encontrado.");
  process.exit(0);
}
for (const name of volumes) {
  const removed = run(`docker volume rm ${name}`);
  if (removed.status !== 0) process.exit(removed.status || 1);
}
console.log("Volume local DEV removido.");
