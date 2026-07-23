/**
 * Diagnóstico: e-mails de aniversário de hoje (SentEmail + Outbox + candidatos).
 * Uso: node --require ./scripts/preload-server-only.cjs --import tsx scripts/diagnose-birthday-emails.ts
 */
import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";
import { getBrazilTodayDateOnly } from "../src/lib/teacher-gamification";

async function main() {
  const today = getBrazilTodayDateOnly();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  console.log("Brazil today (UTC date components):", { year, month, day });
  console.log("EMAIL_PROVIDER:", process.env.EMAIL_PROVIDER ?? "(unset)");
  console.log("RESEND_API_KEY set:", Boolean(process.env.RESEND_API_KEY?.trim()));
  console.log("EMAIL_FROM:", process.env.EMAIL_FROM ?? "(unset)");

  const candidates = await prisma.$queryRaw<
    Array<{ userId: string; name: string; email: string | null; birthDate: Date }>
  >`
    SELECT
      s."userId" AS "userId",
      COALESCE(NULLIF(TRIM(u."name"), ''), s."name") AS "name",
      u."email" AS "email",
      s."birthDate" AS "birthDate"
    FROM "Student" s
    INNER JOIN "User" u ON u.id = s."userId"
    WHERE s."deletedAt" IS NULL
      AND s."userId" IS NOT NULL
      AND u."isActive" = true
      AND s."birthDate" > DATE '1970-01-01'
      AND EXTRACT(MONTH FROM s."birthDate")::int = ${month}
      AND EXTRACT(DAY FROM s."birthDate")::int = ${day}
  `;

  console.log("\n=== Aniversariantes de hoje ===");
  console.log(JSON.stringify(candidates, null, 2));

  const sent = await prisma.sentEmail.findMany({
    where: { emailType: "birthday" },
    orderBy: { sentAt: "desc" },
    take: 20,
  });
  console.log("\n=== SentEmail birthday (últimos 20) ===");
  console.log(
    JSON.stringify(
      sent.map((r) => ({
        id: r.id,
        to: r.to,
        subject: r.subject,
        messageId: r.messageId,
        entityId: r.entityId,
        sentAt: r.sentAt,
      })),
      null,
      2
    )
  );

  const outbox = await prisma.emailOutbox.findMany({
    where: { emailType: "birthday" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log("\n=== EmailOutbox birthday (últimos 20) ===");
  console.log(
    JSON.stringify(
      outbox.map((r) => ({
        id: r.id,
        to: r.to,
        subject: r.subject,
        status: r.status,
        entityId: r.entityId,
        attempts: r.attempts,
        lastError: r.errorMessage,
        createdAt: r.createdAt,
        sentAt: r.sentAt,
      })),
      null,
      2
    )
  );

  for (const c of candidates) {
    const entityId = `${c.userId}:${year}`;
    const relatedSent = sent.filter((s) => s.entityId === entityId || s.to === c.email);
    const relatedOut = outbox.filter((o) => o.entityId === entityId || o.to === c.email);
    console.log(`\n--- ${c.name} <${c.email}> userId=${c.userId} ---`);
    console.log("sent rows:", relatedSent.length, relatedSent.map((s) => ({ messageId: s.messageId, sentAt: s.sentAt })));
    console.log("outbox rows:", relatedOut.length, relatedOut.map((o) => ({ status: o.status, lastError: o.errorMessage })));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
