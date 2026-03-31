/**
 * Remove a pasta .next (cache de build) de forma segura em Windows/macOS/Linux.
 * Use antes do build se houver erro "UNKNOWN: write" ou cache corrompido.
 * No Windows, feche `npm run dev` se aparecer EPERM ao apagar ficheiros.
 */
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(process.cwd(), ".next");

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* espera ocupada curta — só entre tentativas */
  }
}

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    process.stderr.write(`Removido: ${dir}\n`);
    process.exit(0);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
      process.exit(0);
    }
    if (attempt < 3 && e && typeof e === "object" && "code" in e && (e.code === "EPERM" || e.code === "EBUSY")) {
      process.stderr.write(
        `Aviso: não foi possível remover .next (tentativa ${attempt}/3). Feche o servidor de desenvolvimento e tente de novo.\n`
      );
      sleepMs(800);
      continue;
    }
    throw e;
  }
}
