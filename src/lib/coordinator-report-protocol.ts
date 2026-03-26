import { prisma } from "@/lib/prisma";

export async function getNextCoordinatorReportProtocol(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CR${year}-`;
  const last = await prisma.coordinatorReport.findFirst({
    where: { protocolNumber: { startsWith: prefix } },
    orderBy: { protocolNumber: "desc" },
    select: { protocolNumber: true },
  });
  const nextNum = last ? parseInt(last.protocolNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}
