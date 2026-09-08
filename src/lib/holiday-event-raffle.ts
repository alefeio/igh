import "server-only";

import { randomInt } from "node:crypto";

import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type RaffleWinner = {
  drawId: string;
  ticketId: string;
  number: number;
  participantName: string;
  drawnAt: Date;
  eligibleCount: number;
};

export type RaffleView = {
  id: string;
  title: string;
  prize: string | null;
  description: string | null;
  order: number;
  status: string;
  allowRepeatWinner: boolean;
  winner: RaffleWinner | null;
};

const drawSelect = {
  id: true,
  ticketId: true,
  number: true,
  drawnAt: true,
  eligibleCount: true,
  ticket: {
    select: {
      registration: {
        select: { guestName: true, user: { select: { name: true } } },
      },
    },
  },
} as const;

function participantNameOf(reg: {
  guestName: string | null;
  user: { name: string } | null;
}): string {
  return (reg.user?.name ?? reg.guestName ?? "Participante").trim();
}

/** Sorteios de uma ocorrência com o ganhador atual de cada um. */
export async function listRafflesForOccurrence(
  holidayId: string,
  occurrenceDate: string,
): Promise<RaffleView[]> {
  const raffles = await prisma.holidayEventRaffle.findMany({
    where: { holidayId, occurrenceDate },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      prize: true,
      description: true,
      order: true,
      status: true,
      allowRepeatWinner: true,
      draws: {
        where: { status: "WINNER" },
        orderBy: { drawnAt: "desc" },
        take: 1,
        select: drawSelect,
      },
    },
  });

  return raffles.map((raffle) => {
    const draw = raffle.draws[0];
    return {
      id: raffle.id,
      title: raffle.title,
      prize: raffle.prize,
      description: raffle.description,
      order: raffle.order,
      status: raffle.status,
      allowRepeatWinner: raffle.allowRepeatWinner,
      winner: draw
        ? {
            drawId: draw.id,
            ticketId: draw.ticketId,
            number: draw.number,
            participantName: participantNameOf(draw.ticket.registration),
            drawnAt: draw.drawnAt,
            eligibleCount: draw.eligibleCount,
          }
        : null,
    };
  });
}

export type DrawRaffleResult =
  | { ok: true; raffleId: string; winner: RaffleWinner; redrawn: boolean }
  | { ok: false; message: string };

/**
 * Executa o sorteio entre os números emitidos para presenças confirmadas.
 * Por padrão, quem já ganhou outro sorteio da mesma ocorrência é excluído.
 */
export async function drawRaffle(params: {
  raffleId: string;
  performedByUserId: string;
  /** Refaz o sorteio, arquivando o ganhador anterior como REDRAWN. */
  redraw?: boolean;
}): Promise<DrawRaffleResult> {
  const raffle = await prisma.holidayEventRaffle.findUnique({
    where: { id: params.raffleId },
    select: {
      id: true,
      holidayId: true,
      occurrenceDate: true,
      title: true,
      status: true,
      allowRepeatWinner: true,
    },
  });
  if (!raffle) return { ok: false, message: "Sorteio não encontrado." };
  if (raffle.status === "CANCELLED") return { ok: false, message: "Este sorteio foi cancelado." };

  const currentWinner = await prisma.holidayEventRaffleDraw.findFirst({
    where: { raffleId: raffle.id, status: "WINNER" },
    orderBy: { drawnAt: "desc" },
    select: { id: true, number: true },
  });
  if (currentWinner && !params.redraw) {
    return {
      ok: false,
      message: `Este sorteio já foi realizado (número ${currentWinner.number}). Use "Sortear novamente" se precisar refazer.`,
    };
  }

  const eligibleTickets = await prisma.holidayEventRaffleTicket.findMany({
    where: {
      holidayId: raffle.holidayId,
      occurrenceDate: raffle.occurrenceDate,
      registration: { present: true },
      ...(raffle.allowRepeatWinner
        ? { draws: { none: { raffleId: raffle.id, status: "WINNER" } } }
        : { draws: { none: { status: "WINNER" } } }),
    },
    select: {
      id: true,
      number: true,
      registration: { select: { guestName: true, user: { select: { name: true } } } },
    },
  });

  if (eligibleTickets.length === 0) {
    const anyPresent = await prisma.holidayEventRaffleTicket.count({
      where: {
        holidayId: raffle.holidayId,
        occurrenceDate: raffle.occurrenceDate,
        registration: { present: true },
      },
    });
    return {
      ok: false,
      message:
        anyPresent === 0
          ? "Nenhuma presença confirmada ainda. Faça o check-in dos participantes antes de sortear."
          : "Todos os presentes já ganharam algum sorteio desta data. Marque \"permitir ganhador repetido\" se quiser incluí-los.",
    };
  }

  const chosen = eligibleTickets[randomInt(0, eligibleTickets.length)];

  const draw = await prisma.$transaction(async (tx) => {
    if (currentWinner) {
      await tx.holidayEventRaffleDraw.updateMany({
        where: { raffleId: raffle.id, status: "WINNER" },
        data: { status: "REDRAWN" },
      });
    }
    const created = await tx.holidayEventRaffleDraw.create({
      data: {
        raffleId: raffle.id,
        ticketId: chosen.id,
        number: chosen.number,
        eligibleCount: eligibleTickets.length,
        drawnByUserId: params.performedByUserId,
        status: "WINNER",
      },
      select: { id: true, drawnAt: true },
    });
    await tx.holidayEventRaffle.update({
      where: { id: raffle.id },
      data: { status: "DRAWN" },
    });
    return created;
  });

  await createAuditLog({
    entityType: "HolidayEventRaffle",
    entityId: raffle.id,
    action: currentWinner ? "REDRAW" : "DRAW",
    diff: {
      title: raffle.title,
      occurrenceDate: raffle.occurrenceDate,
      winnerNumber: chosen.number,
      eligibleCount: eligibleTickets.length,
      previousWinnerNumber: currentWinner?.number ?? null,
    },
    performedByUserId: params.performedByUserId,
  });

  return {
    ok: true,
    raffleId: raffle.id,
    redrawn: !!currentWinner,
    winner: {
      drawId: draw.id,
      ticketId: chosen.id,
      number: chosen.number,
      participantName: participantNameOf(chosen.registration),
      drawnAt: draw.drawnAt,
      eligibleCount: eligibleTickets.length,
    },
  };
}
