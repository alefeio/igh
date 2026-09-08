import "server-only";

import ExcelJS from "exceljs";

import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FF1F4E79" },
  name: "Calibri",
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
  color: { argb: "FFFFFFFF" },
  name: "Calibri",
};
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};
const BODY_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 11 };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
};
const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

function writeSheet(
  ws: ExcelJS.Worksheet,
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 26;

  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  rows.forEach((values, idx) => {
    const row = ws.getRow(idx + 3);
    values.forEach((value, col) => {
      const cell = row.getCell(col + 1);
      cell.value = value;
      cell.border = THIN_BORDER;
      if (typeof value === "number") cell.alignment = { horizontal: "right", vertical: "middle" };
      if (idx % 2 === 1) cell.fill = ALT_ROW_FILL;
    });
    row.font = BODY_FONT;
  });

  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2 + rows.length, column: headers.length },
    };
  }

  headers.forEach((h, i) => {
    let longest = h.length + 1;
    for (const values of rows) {
      const len = String(values[i] ?? "").length;
      if (len > longest) longest = len;
    }
    ws.getColumn(i + 1).width = Math.min(60, Math.max(10, longest + 2));
  });
}

function formatDateTimeBr(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("pt-BR", { timeZone: "America/Belem" });
}

function presenceLabel(present: boolean | null): string {
  if (present === true) return "Presente";
  if (present === false) return "Ausente";
  return "Não confirmado";
}

/** Planilha com inscrições, indicador, presença, número e sorteios ganhos. */
export async function buildHolidayEventRegistrationsXlsx(params: {
  holidayId: string;
  occurrenceDate: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const holiday = await prisma.holiday.findUnique({
    where: { id: params.holidayId },
    select: {
      id: true,
      name: true,
      slug: true,
      eventStartTime: true,
      eventEndTime: true,
    },
  });
  const eventName = holiday?.name?.trim() || `Evento ${BRAND.shortName}`;

  const registrations = await prisma.holidayEventRegistration.findMany({
    where: { holidayId: params.holidayId, occurrenceDate: params.occurrenceDate },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      present: true,
      attendanceMarkedAt: true,
      checkinCode: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      guestCpf: true,
      user: { select: { name: true, email: true, whatsapp: true } },
      referrerUser: { select: { name: true, email: true } },
      raffleTicket: {
        select: {
          number: true,
          draws: {
            where: { status: "WINNER" },
            select: { raffle: { select: { title: true } } },
          },
        },
      },
    },
  });

  const rows = registrations.map((r) => [
    (r.user?.name ?? r.guestName ?? "—").trim(),
    r.user ? "Com conta" : "Convidado",
    r.user?.email ?? r.guestEmail ?? "—",
    r.user?.whatsapp ?? r.guestPhone ?? "—",
    r.guestCpf ?? "—",
    r.checkinCode ?? "—",
    r.referrerUser?.name ?? "—",
    presenceLabel(r.present),
    formatDateTimeBr(r.attendanceMarkedAt),
    r.raffleTicket?.number ?? "—",
    r.raffleTicket?.draws.map((d) => d.raffle.title).join(", ") || "—",
    formatDateTimeBr(r.createdAt),
  ]);

  // Ranking de indicadores: quem trouxe mais gente e quantos de fato compareceram.
  const rankingMap = new Map<string, { name: string; total: number; present: number }>();
  for (const r of registrations) {
    if (!r.referrerUser) continue;
    const key = r.referrerUser.email;
    const entry = rankingMap.get(key) ?? { name: r.referrerUser.name, total: 0, present: 0 };
    entry.total += 1;
    if (r.present === true) entry.present += 1;
    rankingMap.set(key, entry);
  }
  const ranking = [...rankingMap.entries()]
    .map(([email, v]) => [v.name, email, v.total, v.present] as Array<string | number>)
    .sort((a, b) => {
      const byPresent = (b[3] as number) - (a[3] as number);
      if (byPresent !== 0) return byPresent;
      return (b[2] as number) - (a[2] as number);
    });

  const raffles = await prisma.holidayEventRaffle.findMany({
    where: { holidayId: params.holidayId, occurrenceDate: params.occurrenceDate },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      title: true,
      prize: true,
      status: true,
      draws: {
        orderBy: { drawnAt: "desc" },
        select: {
          number: true,
          status: true,
          drawnAt: true,
          eligibleCount: true,
          drawnByUser: { select: { name: true } },
          ticket: {
            select: {
              registration: { select: { guestName: true, user: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  const raffleRows: Array<Array<string | number>> = [];
  for (const raffle of raffles) {
    if (raffle.draws.length === 0) {
      raffleRows.push([
        raffle.title,
        raffle.prize ?? "—",
        raffle.status,
        "—",
        "—",
        "—",
        "—",
        "—",
      ]);
      continue;
    }
    for (const draw of raffle.draws) {
      const reg = draw.ticket.registration;
      raffleRows.push([
        raffle.title,
        raffle.prize ?? "—",
        raffle.status,
        draw.status === "WINNER" ? "Ganhador" : "Re-sorteado",
        draw.number,
        (reg.user?.name ?? reg.guestName ?? "—").trim(),
        draw.eligibleCount,
        `${formatDateTimeBr(draw.drawnAt)}${draw.drawnByUser ? ` · ${draw.drawnByUser.name}` : ""}`,
      ]);
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = `Cadastro Cursos ${BRAND.shortName}`;
  wb.created = new Date();

  const header = `${eventName} — ${params.occurrenceDate}`;

  writeSheet(
    wb.addWorksheet("Inscrições", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] }),
    `${header} · inscrições`,
    [
      "Participante",
      "Tipo",
      "E-mail",
      "Telefone",
      "CPF",
      "Código check-in",
      "Indicado por",
      "Presença",
      "Presença confirmada em",
      "Nº sorteio",
      "Sorteios ganhos",
      "Inscrito em",
    ],
    rows,
  );

  writeSheet(
    wb.addWorksheet("Indicadores", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] }),
    `${header} · ranking de indicadores`,
    ["Indicador", "E-mail", "Indicações", "Compareceram"],
    ranking,
  );

  writeSheet(
    wb.addWorksheet("Sorteios", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] }),
    `${header} · sorteios`,
    [
      "Sorteio",
      "Prêmio",
      "Situação",
      "Resultado",
      "Número",
      "Participante",
      "Elegíveis no sorteio",
      "Executado em",
    ],
    raffleRows,
  );

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const slugPart = (holiday?.slug ?? params.holidayId).slice(0, 50);
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: `evento-${slugPart}-${params.occurrenceDate}.xlsx`,
  };
}
