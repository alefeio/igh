/**
 * Disparo manual do job de aniversário (notificação + e-mail) para o dia de hoje (calendário Brasil).
 *
 * Uso (local / contra o banco do .env):
 *   node --require ./scripts/preload-server-only.cjs --import tsx scripts/run-birthday-today.ts
 *
 * Em produção (após deploy), preferir a rota do cron:
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://SEU_DOMINIO/api/cron/birthday-notifications"
 */
import "../prisma/load-env";
import { runBirthdayNotificationsForToday } from "../src/lib/birthday-notifications";

async function main() {
  const result = await runBirthdayNotificationsForToday();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
