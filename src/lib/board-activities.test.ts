import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  activityOverlapsPeriod,
  AGENDA_EXCLUDED_CLASS_GROUP_STATUSES,
  applyStatusSideEffects,
  assembleAgendaSessions,
  belemDateParts,
  belemDayStartUtc,
  BOARD_CUSTOM_RANGE_MAX_DAYS,
  buildClassSessionAgendaWhere,
  canEditBoardActivityMain,
  canMoveBoardActivity,
  canTransitionStatus,
  defaultPlannedStartDate,
  initialStatusOnCreate,
  isActivityOverdue,
  isAgendaEligibleClassGroupStatus,
  isMasterOrAdminRole,
  mapAgendaSessions,
  markTeacherScheduleConflicts,
  parseIsoDateOnly,
  resolveBoardPeriod,
  sessionTimesOverlap,
} from "@/lib/board-activities";
import { createBoardActivitySchema, updateBoardActivitySchema } from "@/lib/validators/board-activities";

describe("board-activities period", () => {
  it("default range is today when empty", () => {
    const r = resolveBoardPeriod({ from: null, to: null, now: new Date("2026-09-24T15:00:00.000Z") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.from).toBe("2026-09-24");
    expect(r.range.to).toBe("2026-09-24");
  });

  it("rejects inverted range", () => {
    const r = resolveBoardPeriod({ from: "2026-09-25", to: "2026-09-24" });
    expect(r.ok).toBe(false);
  });

  it("rejects range over 31 days", () => {
    const r = resolveBoardPeriod({ from: "2026-09-01", to: "2026-10-05" });
    expect(r.ok).toBe(false);
  });

  it("accepts custom range of exactly 31 days", () => {
    const r = resolveBoardPeriod({ from: "2026-09-01", to: "2026-10-01" });
    expect(r.ok).toBe(true);
  });

  it("uses America/Belem for day boundary (UTC evening still previous Belém day)", () => {
    // 2026-09-24 02:30 UTC = 2026-09-23 23:30 in Belém (UTC-3)
    const parts = belemDateParts(new Date("2026-09-24T02:30:00.000Z"));
    expect(parts).toEqual({ y: 2026, m: 9, d: 23 });
  });
});

describe("board-activities period overlap filter", () => {
  const fromUtc = belemDayStartUtc(2026, 9, 24);
  const toExclusiveUtc = belemDayStartUtc(2026, 9, 25);

  it("includes one-day activity on the filter day", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 24),
        plannedEndAt: null,
        startedAt: null,
        completedAt: null,
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });

  it("includes multi-day activity spanning the filter day", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 20),
        plannedEndAt: belemDayStartUtc(2026, 9, 28),
        startedAt: null,
        completedAt: null,
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });

  it("includes in-progress started before period", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 1),
        plannedEndAt: belemDayStartUtc(2026, 9, 2),
        startedAt: belemDayStartUtc(2026, 9, 10),
        completedAt: null,
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });

  it("includes completed within period", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 1),
        plannedEndAt: null,
        startedAt: belemDayStartUtc(2026, 9, 20),
        completedAt: belemDayStartUtc(2026, 9, 24),
        fromUtc,
        toExclusiveUtc,
      }),
    ).toBe(true);
  });
});

describe("board-activities transitions", () => {
  it("allows planned -> in progress", () => {
    expect(canTransitionStatus("PLANNED", "IN_PROGRESS")).toBe(true);
  });
  it("blocks planned -> done", () => {
    expect(canTransitionStatus("PLANNED", "DONE")).toBe(false);
  });
  it("sets startedAt when entering in progress", () => {
    const side = applyStatusSideEffects("PLANNED", "IN_PROGRESS", new Date("2026-09-24T12:00:00Z"));
    expect(side.startedAt?.toISOString()).toBe("2026-09-24T12:00:00.000Z");
  });
  it("clears completedAt on reopen", () => {
    const side = applyStatusSideEffects("DONE", "IN_PROGRESS");
    expect(side.completedAt).toBeNull();
  });
});

describe("board-activities permissions", () => {
  it("only creator or assignee can move; third party cannot (including admin role alone)", () => {
    expect(canMoveBoardActivity({ actorId: "a", creatorId: "a", assigneeId: "b" })).toBe(true);
    expect(canMoveBoardActivity({ actorId: "b", creatorId: "a", assigneeId: "b" })).toBe(true);
    expect(canMoveBoardActivity({ actorId: "admin", creatorId: "a", assigneeId: "b" })).toBe(false);
  });
  it("only creator edits main fields", () => {
    expect(canEditBoardActivityMain({ actorId: "a", creatorId: "a" })).toBe(true);
    expect(canEditBoardActivityMain({ actorId: "b", creatorId: "a" })).toBe(false);
  });
  it("isMasterOrAdminRole covers Master/Admin only", () => {
    expect(isMasterOrAdminRole("MASTER")).toBe(true);
    expect(isMasterOrAdminRole("ADMIN")).toBe(true);
    expect(isMasterOrAdminRole("TEACHER")).toBe(false);
    expect(isMasterOrAdminRole("POLO_COORDINATOR")).toBe(false);
  });
});

describe("board-activities overdue", () => {
  it("marks overdue when planned end before today and not done", () => {
    const start = belemDayStartUtc(2026, 9, 20);
    expect(
      isActivityOverdue({
        status: "IN_PROGRESS",
        plannedStartAt: start,
        plannedEndAt: start,
        now: new Date("2026-09-24T15:00:00.000Z"),
      }),
    ).toBe(true);
  });
  it("done is never overdue", () => {
    const start = belemDayStartUtc(2026, 9, 20);
    expect(
      isActivityOverdue({
        status: "DONE",
        plannedStartAt: start,
        plannedEndAt: start,
        now: new Date("2026-09-24T15:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("parseIsoDateOnly", () => {
  it("parses valid", () => {
    expect(parseIsoDateOnly("2026-09-24")).toEqual({ y: 2026, m: 9, d: 24 });
  });
});

describe("agenda conflict detection", () => {
  it("detects overlapping times for same teacher", () => {
    expect(sessionTimesOverlap("08:00", "10:00", "09:00", "11:00")).toBe(true);
    expect(sessionTimesOverlap("08:00", "09:00", "09:00", "10:00")).toBe(false);
  });

  it("marks conflict and ignores canceled sessions", () => {
    const slots = markTeacherScheduleConflicts([
      {
        date: "2026-09-24",
        startTime: "08:00",
        endTime: "10:00",
        status: "SCHEDULED",
        teachers: [{ id: "t1" }],
        conflict: false,
      },
      {
        date: "2026-09-24",
        startTime: "09:00",
        endTime: "11:00",
        status: "SCHEDULED",
        teachers: [{ id: "t1" }],
        conflict: false,
      },
      {
        date: "2026-09-24",
        startTime: "09:30",
        endTime: "10:30",
        status: "CANCELED",
        teachers: [{ id: "t1" }],
        conflict: false,
      },
    ]);
    expect(slots[0].conflict).toBe(true);
    expect(slots[1].conflict).toBe(true);
    expect(slots[2].conflict).toBe(false);
  });
});

describe("agenda de todos os polos", () => {
  const day = new Date("2026-09-24T15:00:00.000Z");

  function session(partial: {
    id: string;
    startTime: string;
    status?: string;
    isExternal: boolean;
    polo: string;
    locationName: string;
    sala?: string | null;
    teacherId: string;
  }) {
    return {
      id: partial.id,
      sessionDate: day,
      startTime: partial.startTime,
      endTime: "10:00",
      status: partial.status ?? "SCHEDULED",
      classGroup: {
        id: `g-${partial.id}`,
        location: partial.sala ?? null,
        isExternal: partial.isExternal,
        course: { name: "Informática" },
        poloLocation: { name: partial.locationName, polo: { name: partial.polo } },
        teacher: { id: partial.teacherId, name: "Prof" },
        classGroupTeachers: [],
      },
    };
  }

  it("inclui sede, outra unidade interna e polo externo no mesmo período", () => {
    const where = buildClassSessionAgendaWhere({
      fromUtc: belemDayStartUtc(2026, 9, 24),
      toExclusiveUtc: belemDayStartUtc(2026, 9, 25),
    });
    expect(where.sessionDate).toEqual({
      gte: belemDayStartUtc(2026, 9, 24),
      lt: belemDayStartUtc(2026, 9, 25),
    });
    expect(where.classGroup.status.notIn).toEqual(["CANCELADA"]);
    expect(JSON.stringify(where)).not.toContain("poloLocationId");

    const slots = mapAgendaSessions([
      session({
        id: "sede",
        startTime: "08:00",
        isExternal: false,
        polo: "Condor",
        locationName: "Padre Eutíquio",
        teacherId: "t1",
      }),
      session({
        id: "outra",
        startTime: "09:00",
        isExternal: false,
        polo: "Guamá",
        locationName: "14 de Abril",
        teacherId: "t2",
      }),
      session({
        id: "ext",
        startTime: "11:00",
        isExternal: true,
        polo: "Icoaraci",
        locationName: "Pratinha",
        teacherId: "t3",
      }),
      session({
        id: "cancelada",
        startTime: "13:00",
        status: "CANCELED",
        isExternal: true,
        polo: "Icoaraci",
        locationName: "Cruzeiro",
        teacherId: "t1",
      }),
    ]);

    expect(slots.map((s) => s.id)).toEqual(["sede", "outra", "ext", "cancelada"]);
    expect(slots.map((s) => s.poloName)).toEqual(["Condor", "Guamá", "Icoaraci", "Icoaraci"]);
    expect(slots.find((s) => s.id === "sede")?.isExternal).toBe(false);
    expect(slots.find((s) => s.id === "ext")?.isExternal).toBe(true);
    expect(slots.find((s) => s.id === "cancelada")?.status).toBe("CANCELED");
    expect(new Set(slots.map((s) => s.id)).size).toBe(4);
  });

  it("exclui aula fora do período e detecta conflito entre polos", () => {
    const where = buildClassSessionAgendaWhere({
      fromUtc: belemDayStartUtc(2026, 9, 24),
      toExclusiveUtc: belemDayStartUtc(2026, 9, 25),
    });
    const outside = new Date("2026-09-23T15:00:00.000Z");
    expect(outside >= where.sessionDate.gte && outside < where.sessionDate.lt).toBe(false);

    const slots = mapAgendaSessions([
      session({
        id: "a",
        startTime: "08:00",
        isExternal: false,
        polo: "Condor",
        locationName: "Padre Eutíquio",
        teacherId: "t1",
      }),
      {
        ...session({
          id: "b",
          startTime: "09:00",
          isExternal: true,
          polo: "Icoaraci",
          locationName: "Pratinha",
          teacherId: "t1",
        }),
        endTime: "11:00",
      },
    ]);
    expect(slots.every((s) => s.conflict)).toBe(true);
  });
});

describe("início planejado e criação concluída", () => {
  it("usa o dia de Belém quando UTC já virou o dia", () => {
    const date = defaultPlannedStartDate(new Date("2026-09-24T02:30:00.000Z"));
    expect(date).toBe("2026-09-23");
  });

  it("edição não substitui a data já gravada", () => {
    const parsed = updateBoardActivitySchema.safeParse({ title: "Ajuste" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.plannedStartAt).toBeUndefined();
  });

  it("o usuário pode substituir a data padrão", () => {
    const today = defaultPlannedStartDate(new Date("2026-09-24T15:00:00.000Z"));
    expect(today).toBe("2026-09-24");
    const chosen = "2026-08-01";
    expect(chosen).not.toBe(today);
  });

  it("checkbox desmarcado mantém PLANNED e marcado cria DONE", () => {
    expect(initialStatusOnCreate(false)).toBe("PLANNED");
    expect(initialStatusOnCreate(true)).toBe("DONE");
  });

  it("rejeita status arbitrário no payload de criação", () => {
    const base = {
      title: "Aula extra",
      assigneeId: "11111111-1111-4111-8111-111111111111",
      plannedStartAt: "2026-08-01",
    };
    expect(createBoardActivitySchema.safeParse({ ...base, markCompleted: false }).success).toBe(true);
    expect(createBoardActivitySchema.safeParse({ ...base, markCompleted: true }).data?.markCompleted).toBe(
      true,
    );
    expect(createBoardActivitySchema.safeParse({ ...base, status: "DONE" }).success).toBe(false);
    expect(createBoardActivitySchema.safeParse({ ...base, status: "IN_PROGRESS" }).success).toBe(false);
    expect(createBoardActivitySchema.safeParse({ ...base, markCompleted: "true" }).success).toBe(false);
  });

  it("atividade retroativa concluída continua no período planejado", () => {
    expect(
      activityOverlapsPeriod({
        plannedStartAt: belemDayStartUtc(2026, 9, 24),
        plannedEndAt: belemDayStartUtc(2026, 9, 24),
        startedAt: null,
        completedAt: new Date("2026-09-25T18:00:00.000Z"),
        fromUtc: belemDayStartUtc(2026, 9, 24),
        toExclusiveUtc: belemDayStartUtc(2026, 9, 25),
      }),
    ).toBe(true);
  });
});

describe("filtro de turma e volume da agenda", () => {
  const day = new Date("2026-09-24T15:00:00.000Z");

  function row(args: {
    id: string;
    groupStatus: string;
    sessionStatus?: string;
    isExternal?: boolean;
    startTime?: string;
    teacherId?: string;
    endTime?: string;
  }) {
    return {
      id: args.id,
      sessionDate: day,
      startTime: args.startTime ?? "08:00",
      endTime: args.endTime ?? "09:00",
      status: args.sessionStatus ?? "SCHEDULED",
      classGroup: {
        id: `g-${args.id}`,
        status: args.groupStatus,
        location: "Sala",
        isExternal: args.isExternal ?? false,
        course: { name: "Curso" },
        poloLocation: { name: "Local", polo: { name: "Polo" } },
        teacher: { id: args.teacherId ?? "t1", name: "Prof" },
        classGroupTeachers: [],
      },
    };
  }

  it("exibe turmas planejada, em andamento, aberta e encerrada", () => {
    const slots = assembleAgendaSessions([
      row({ id: "planejada", groupStatus: "PLANEJADA" }),
      row({ id: "andamento", groupStatus: "EM_ANDAMENTO", startTime: "09:00" }),
      row({ id: "aberta", groupStatus: "ABERTA", startTime: "10:00" }),
      row({ id: "encerrada", groupStatus: "ENCERRADA", startTime: "11:00" }),
    ]);
    expect(slots.map((slot) => slot.id)).toEqual(["planejada", "andamento", "aberta", "encerrada"]);
  });

  it("omite turma inativa e turma cancelada — ambos são CANCELADA no schema", () => {
    expect(AGENDA_EXCLUDED_CLASS_GROUP_STATUSES).toEqual(["CANCELADA"]);
    expect(isAgendaEligibleClassGroupStatus("CANCELADA")).toBe(false);
    const slots = assembleAgendaSessions([
      row({ id: "ok", groupStatus: "ABERTA" }),
      row({ id: "inativa", groupStatus: "CANCELADA", startTime: "09:00" }),
      row({ id: "cancelada", groupStatus: "CANCELADA", startTime: "10:00", isExternal: true }),
    ]);
    expect(slots.map((slot) => slot.id)).toEqual(["ok"]);
  });

  it("mantém aula cancelada de turma permitida e não a usa em conflito", () => {
    const slots = assembleAgendaSessions([
      row({
        id: "aula",
        groupStatus: "EM_ANDAMENTO",
        startTime: "08:00",
        endTime: "10:00",
      }),
      row({
        id: "aula-cancelada",
        groupStatus: "PLANEJADA",
        sessionStatus: "CANCELED",
        startTime: "09:00",
        endTime: "11:00",
      }),
    ]);
    expect(slots.find((slot) => slot.id === "aula-cancelada")?.status).toBe("CANCELED");
    expect(slots.every((slot) => slot.conflict === false)).toBe(true);
  });

  it("turma excluída não gera conflito, interna ou externa", () => {
    const slots = assembleAgendaSessions([
      row({
        id: "interna",
        groupStatus: "PLANEJADA",
        isExternal: false,
        startTime: "08:00",
        endTime: "10:00",
      }),
      row({
        id: "externa-cancelada",
        groupStatus: "CANCELADA",
        isExternal: true,
        startTime: "08:30",
        endTime: "10:30",
      }),
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.isExternal).toBe(false);
    expect(slots[0]?.conflict).toBe(false);
  });

  it("devolve mais de 1000 sessões, sem omissão nem duplicata, ordenadas", () => {
    const many = Array.from({ length: 1001 }, (_, index) =>
      row({
        id: `s-${String(index).padStart(4, "0")}`,
        groupStatus: index % 2 === 0 ? "ABERTA" : "ENCERRADA",
        isExternal: index % 3 === 0,
        startTime: index % 2 === 0 ? "08:00" : "09:00",
        endTime: "10:00",
      }),
    );
    const reversed = [...many].reverse();
    const firstPage = reversed.slice(0, 600);
    const secondPage = reversed.slice(500);
    const slots = assembleAgendaSessions([...firstPage, ...secondPage]);
    expect(slots).toHaveLength(1001);
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(1001);
    const ordered = [...slots].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.id.localeCompare(b.id),
    );
    expect(slots.map((slot) => slot.id)).toEqual(ordered.map((slot) => slot.id));
    expect(slots.some((slot) => slot.conflict)).toBe(true);
  });

  it("mantém o teto de 31 dias e a exigência de acesso na API", () => {
    expect(BOARD_CUSTOM_RANGE_MAX_DAYS).toBe(31);
    const source = readFileSync("src/app/api/gestao/atividades/agenda/route.ts", "utf8");
    expect(source).toContain("requireBoardAccess()");
    expect(source).not.toMatch(/take:\s*1000/);
    expect(source).toContain('orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }, { id: "asc" }]');
  });
});
