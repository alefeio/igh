import { BRAND } from "@/lib/brand";
import { getAppUrl } from "@/lib/email";
import { jsonErr } from "@/lib/http";
import {
  findPublicHolidayEventByKey,
  resolveHolidayEventOccurrence,
} from "@/lib/holiday-event-public";
import { holidayEventPublicPath } from "@/lib/holiday-event-slug";

/** Escapa vírgula, ponto-e-vírgula, barra invertida e quebra de linha conforme RFC 5545. */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Converte data local de Belém (UTC-3) e HH:mm em timestamp UTC no formato ICS. */
function toUtcStamp(ymd: string, hm: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const [hh, mm] = hm.split(":").map((x) => parseInt(x, 10));
  const utc = new Date(Date.UTC(y, m - 1, d, hh + 3, mm, 0));
  return `${utc.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ holidayId: string }> },
) {
  const { holidayId } = await context.params;
  const event = await findPublicHolidayEventByKey(holidayId);
  if (!event) return jsonErr("NOT_FOUND", "Evento não encontrado.", 404);

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("data")?.trim() ?? null;
  const { occurrenceDate } = resolveHolidayEventOccurrence(event, requested);
  if (!occurrenceDate) return jsonErr("NOT_FOUND", "Data do evento não encontrada.", 404);

  const name = event.name?.trim() || `Evento ${BRAND.shortName}`;
  const url = getAppUrl(holidayEventPublicPath(event, occurrenceDate));
  const description = [event.subtitle?.trim(), event.publicDescription?.trim(), url]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsEscape(BRAND.legalName)}//Eventos//PT-BR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}-${occurrenceDate}@${new URL(getAppUrl("/")).host}`,
    `DTSTAMP:${toUtcStamp(occurrenceDate, event.eventStartTime?.slice(0, 5) ?? "08:00")}`,
    `DTSTART:${toUtcStamp(occurrenceDate, event.eventStartTime?.slice(0, 5) ?? "08:00")}`,
    `DTEND:${toUtcStamp(occurrenceDate, event.eventEndTime?.slice(0, 5) ?? "11:00")}`,
    `SUMMARY:${icsEscape(name)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(BRAND.legalName)}`,
    `URL:${icsEscape(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const fileName = `${(event.slug ?? event.id).slice(0, 60)}-${occurrenceDate}.ics`;

  return new Response(lines.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
