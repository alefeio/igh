import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireRole(["STUDENT", "TEACHER", "ADMIN", "MASTER", "COORDINATOR"]);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.trim();
    const to = searchParams.get("to")?.trim();

    const registrations = await prisma.holidayEventRegistration.findMany({
      where: {
        userId: user.id,
        ...(from && to
          ? { occurrenceDate: { gte: from, lte: to } }
          : from
            ? { occurrenceDate: { gte: from } }
            : to
              ? { occurrenceDate: { lte: to } }
              : {}),
      },
      select: {
        id: true,
        holidayId: true,
        occurrenceDate: true,
        createdAt: true,
      },
      orderBy: { occurrenceDate: "asc" },
    });

    return jsonOk({ registrations });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
