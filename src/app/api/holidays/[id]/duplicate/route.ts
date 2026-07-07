import { prisma } from "@/lib/prisma";
import { requireMaster } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";

function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireMaster();
  const { id } = await context.params;

  const source = await prisma.holiday.findUnique({ where: { id } });
  if (!source) return jsonErr("NOT_FOUND", "Registro não encontrado.", 404);

  const isEvent = !!(source.eventStartTime?.trim() && source.eventEndTime?.trim());
  const baseName = source.name?.trim();
  const copyName = baseName ? `${baseName} (cópia)` : "Cópia";

  let date = source.date;
  const eventStartTime = source.eventStartTime;
  const eventEndTime = source.eventEndTime;

  if (!isEvent) {
    const existsAt = async (d: Date) =>
      prisma.holiday.findFirst({
        where: {
          date: d,
          recurring: source.recurring,
          eventStartTime,
          eventEndTime,
        },
        select: { id: true },
      });

    let conflict = await existsAt(date);
    if (conflict && !source.recurring) {
      for (let i = 1; i <= 31 && conflict; i++) {
        date = addUtcDays(source.date, i);
        conflict = await existsAt(date);
      }
    }

    if (conflict) {
      return jsonErr(
        "DUPLICATE_DATE",
        source.recurring
          ? "Não foi possível duplicar: já existe feriado recorrente neste dia e mês."
          : "Não foi possível duplicar: já existe feriado nesta data. Ajuste manualmente no formulário.",
        409
      );
    }
  }

  const holiday = await prisma.holiday.create({
    data: {
      date,
      recurring: source.recurring,
      name: copyName,
      isActive: false,
      eventStartTime,
      eventEndTime,
      allowsRegistration: isEvent ? source.allowsRegistration : false,
      publicDescription: source.publicDescription,
      subtitle: isEvent ? source.subtitle : null,
    },
  });

  await createAuditLog({
    entityType: "Holiday",
    entityId: holiday.id,
    action: "CREATE",
    diff: { duplicatedFrom: source.id, after: holiday },
    performedByUserId: user.id,
  });

  return jsonOk({ holiday }, { status: 201 });
}
