import { prisma } from "@/lib/prisma";
import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { normalizeHolidayTimeHm } from "@/lib/validators/holidays";

function shiftHmByMinutes(hm: string, deltaMinutes: number): string {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  let total = h * 60 + m + deltaMinutes;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffWrite();
  const { id } = await context.params;

  const source = await prisma.holiday.findUnique({ where: { id } });
  if (!source) return jsonErr("NOT_FOUND", "Registro não encontrado.", 404);

  const isEvent = !!(source.eventStartTime?.trim() && source.eventEndTime?.trim());
  const baseName = source.name?.trim();
  const copyName = baseName ? `${baseName} (cópia)` : "Cópia";

  let date = source.date;
  let eventStartTime = source.eventStartTime;
  let eventEndTime = source.eventEndTime;

  const existsAt = async () =>
    prisma.holiday.findFirst({
      where: { date, recurring: source.recurring, eventStartTime, eventEndTime },
      select: { id: true },
    });

  let conflict = await existsAt();
  if (conflict) {
    if (isEvent && eventStartTime && eventEndTime) {
      for (let i = 1; i <= 48 && conflict; i++) {
        eventStartTime = normalizeHolidayTimeHm(shiftHmByMinutes(source.eventStartTime!, i * 30));
        eventEndTime = normalizeHolidayTimeHm(shiftHmByMinutes(source.eventEndTime!, i * 30));
        if (eventStartTime >= eventEndTime) continue;
        conflict = await existsAt();
      }
    } else if (!source.recurring) {
      for (let i = 1; i <= 31 && conflict; i++) {
        date = addUtcDays(source.date, i);
        conflict = await existsAt();
      }
    }
  }

  if (conflict) {
    return jsonErr(
      "DUPLICATE_DATE",
      "Não foi possível duplicar automaticamente: já existe registro com a mesma data e horário. Ajuste manualmente no formulário.",
      409
    );
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
