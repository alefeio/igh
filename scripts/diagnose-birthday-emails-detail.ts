/**
 * Compara User.email vs Student.email dos aniversariantes e lista messageIds do Resend.
 */
import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";
import { getBrazilTodayDateOnly } from "../src/lib/teacher-gamification";

async function main() {
  const today = getBrazilTodayDateOnly();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();

  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      userName: string;
      userEmail: string;
      studentEmail: string | null;
      studentName: string;
    }>
  >`
    SELECT
      u.id AS "userId",
      u.name AS "userName",
      u.email AS "userEmail",
      s.email AS "studentEmail",
      s.name AS "studentName"
    FROM "Student" s
    INNER JOIN "User" u ON u.id = s."userId"
    WHERE s."deletedAt" IS NULL
      AND u."isActive" = true
      AND s."birthDate" > DATE '1970-01-01'
      AND EXTRACT(MONTH FROM s."birthDate")::int = ${month}
      AND EXTRACT(DAY FROM s."birthDate")::int = ${day}
  `;

  const sent = await prisma.sentEmail.findMany({
    where: {
      emailType: "birthday",
      entityId: { in: rows.map((r) => `${r.userId}:${year}`) },
    },
  });

  for (const r of rows) {
    const entityId = `${r.userId}:${year}`;
    const s = sent.find((x) => x.entityId === entityId);
    const mismatch =
      r.studentEmail &&
      r.studentEmail.trim().toLowerCase() !== r.userEmail.trim().toLowerCase();
    console.log({
      name: r.userName,
      sentTo: s?.to ?? null,
      userEmail: r.userEmail,
      studentEmail: r.studentEmail,
      emailMismatch: Boolean(mismatch),
      resendMessageId: s?.messageId ?? null,
      sentAt: s?.sentAt ?? null,
      subject: s?.subject ?? null,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
