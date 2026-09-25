/**
 * Quadro de Atividades — regras de domínio compartilhadas (API + UI).
 * Fuso do piloto: America/Belem.
 */

import type { BoardActivityStatus, ClassGroupStatus, UserRole } from "@/generated/prisma/client";

export const BOARD_TZ = "America/Belem";

export const BOARD_ACTIVITY_STATUS_LABEL: Record<BoardActivityStatus, string> = {
  PLANNED: "Planejadas",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluídas",
};

export const BOARD_REACTION_EMOJIS = ["👍", "❤️", "👏", "✅"] as const;
export type BoardReactionEmoji = (typeof BOARD_REACTION_EMOJIS)[number];

export const BOARD_COMMENT_MAX_LEN = 2000;
export const BOARD_TITLE_MAX_LEN = 200;
export const BOARD_DESCRIPTION_MAX_LEN = 5000;
export const BOARD_CUSTOM_RANGE_MAX_DAYS = 31;

/** Papéis internos elegíveis ao quadro (estudante excluído). */
export const BOARD_ELIGIBLE_ROLES: readonly UserRole[] = [
  "MASTER",
  "GENERAL_ADMIN",
  "ADMIN",
  "ADMIN_MANAGER",
  "SITE_ADMIN",
  "POLO_COORDINATOR",
  "DIRECTOR",
  "TEACHER",
] as const;

export function isBoardEligibleRole(role: string): boolean {
  return (BOARD_ELIGIBLE_ROLES as readonly string[]).includes(role);
}

export function isBoardReactionEmoji(value: string): value is BoardReactionEmoji {
  return (BOARD_REACTION_EMOJIS as readonly string[]).includes(value);
}

/** Partes de data no fuso de Belém. */
export function belemDateParts(date = new Date()): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOARD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d };
}

/** Início do dia civil em Belém → Instant UTC. */
export function belemDayStartUtc(y: number, m: number, d: number): Date {
  // America/Belem is UTC-3 year-round (no DST).
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
}

/** Fim exclusivo do dia (início do dia seguinte). */
export function belemDayEndExclusiveUtc(y: number, m: number, d: number): Date {
  const start = belemDayStartUtc(y, m, d);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function parseIsoDateOnly(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export function formatIsoDateOnly(parts: { y: number; m: number; d: number }): string {
  return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

export function addCalendarDays(parts: { y: number; m: number; d: number }, days: number) {
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d + days);
  const dt = new Date(utc);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function startOfWeekMondayBelem(ref = new Date()): { y: number; m: number; d: number } {
  const today = belemDateParts(ref);
  // day of week in Belém
  const noonUtc = belemDayStartUtc(today.y, today.m, today.d);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BOARD_TZ,
    weekday: "short",
  }).format(noonUtc);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = map[weekday] ?? 0;
  return addCalendarDays(today, -offset);
}

export type BoardPeriodRange = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD inclusive
  fromUtc: Date;
  toExclusiveUtc: Date;
};

export function resolveBoardPeriod(args: {
  from?: string | null;
  to?: string | null;
  now?: Date;
}): { ok: true; range: BoardPeriodRange } | { ok: false; message: string } {
  const now = args.now ?? new Date();
  const today = belemDateParts(now);

  const fromParts = args.from ? parseIsoDateOnly(args.from) : today;
  const toParts = args.to ? parseIsoDateOnly(args.to) : fromParts;

  if (!fromParts || !toParts) {
    return { ok: false, message: "Datas inválidas. Use o formato AAAA-MM-DD." };
  }

  const fromUtc = belemDayStartUtc(fromParts.y, fromParts.m, fromParts.d);
  const toStart = belemDayStartUtc(toParts.y, toParts.m, toParts.d);
  if (toStart.getTime() < fromUtc.getTime()) {
    return { ok: false, message: "A data final não pode ser anterior à inicial." };
  }

  const days =
    Math.round((toStart.getTime() - fromUtc.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days > BOARD_CUSTOM_RANGE_MAX_DAYS) {
    return {
      ok: false,
      message: `O período personalizado pode ter no máximo ${BOARD_CUSTOM_RANGE_MAX_DAYS} dias.`,
    };
  }

  const toExclusiveUtc = belemDayEndExclusiveUtc(toParts.y, toParts.m, toParts.d);
  return {
    ok: true,
    range: {
      from: formatIsoDateOnly(fromParts),
      to: formatIsoDateOnly(toParts),
      fromUtc,
      toExclusiveUtc,
    },
  };
}

/** Sobreposição com período planejado OU intervalo real (startedAt..completedAt/open). */
export function activityOverlapsPeriod(args: {
  plannedStartAt: Date;
  plannedEndAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  fromUtc: Date;
  toExclusiveUtc: Date;
}): boolean {
  const plannedEnd = args.plannedEndAt ?? args.plannedStartAt;
  const plannedOverlap =
    args.plannedStartAt.getTime() < args.toExclusiveUtc.getTime() &&
    plannedEnd.getTime() >= args.fromUtc.getTime();

  if (plannedOverlap) return true;

  if (!args.startedAt) return false;
  // Em andamento (completedAt null): sobrepõe se iniciou antes do fim do período
  // (mesmo critério do filtro Prisma em boardActivityListWhere).
  if (args.completedAt == null) {
    return args.startedAt.getTime() < args.toExclusiveUtc.getTime();
  }
  return (
    args.startedAt.getTime() < args.toExclusiveUtc.getTime() &&
    args.completedAt.getTime() >= args.fromUtc.getTime()
  );
}

export function isActivityOverdue(args: {
  status: BoardActivityStatus;
  plannedEndAt: Date | null;
  plannedStartAt: Date;
  now?: Date;
}): boolean {
  if (args.status === "DONE") return false;
  const end = args.plannedEndAt ?? args.plannedStartAt;
  const now = args.now ?? new Date();
  const today = belemDateParts(now);
  const endParts = belemDateParts(end);
  const exclusive = belemDayEndExclusiveUtc(endParts.y, endParts.m, endParts.d);
  return exclusive.getTime() <= belemDayStartUtc(today.y, today.m, today.d).getTime();
}

const ALLOWED_TRANSITIONS: Record<BoardActivityStatus, BoardActivityStatus[]> = {
  PLANNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["PLANNED", "DONE"],
  DONE: ["IN_PROGRESS"],
};

export function canTransitionStatus(
  from: BoardActivityStatus,
  to: BoardActivityStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canMoveBoardActivity(args: {
  actorId: string;
  creatorId: string;
  assigneeId: string;
  assigneeIds?: string[];
}): boolean {
  if (args.actorId === args.creatorId) return true;
  if (args.assigneeIds?.includes(args.actorId)) return true;
  return args.actorId === args.assigneeId;
}

export function canOpenBoardActivity(args: {
  actorId: string;
  creatorId: string;
  isPrivate: boolean;
  assigneeId: string;
  assigneeIds?: string[];
}): boolean {
  if (!args.isPrivate) return true;
  if (args.actorId === args.creatorId) return true;
  if (args.actorId === args.assigneeId) return true;
  return args.assigneeIds?.includes(args.actorId) ?? false;
}

export function canEditBoardActivityMain(args: {
  actorId: string;
  creatorId: string;
}): boolean {
  return args.actorId === args.creatorId;
}

export function applyStatusSideEffects(
  from: BoardActivityStatus,
  to: BoardActivityStatus,
  now = new Date(),
): { startedAt?: Date | null; completedAt?: Date | null } {
  if (from === to) return {};
  if (to === "IN_PROGRESS" && from === "PLANNED") {
    return { startedAt: now, completedAt: null };
  }
  if (to === "IN_PROGRESS" && from === "DONE") {
    return { completedAt: null };
  }
  if (to === "DONE") {
    return { completedAt: now };
  }
  if (to === "PLANNED" && from === "IN_PROGRESS") {
    return {};
  }
  return {};
}

export function isMasterOrAdminRole(role: string): boolean {
  return role === "MASTER" || role === "GENERAL_ADMIN" || role === "ADMIN";
}

/** Resolve unidade do piloto sem hardcode de Belém. */
export function resolvePilotUnitIdFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const id = env.BOARD_ACTIVITIES_POLO_LOCATION_ID?.trim();
  return id && id.length > 0 ? id : null;
}

/** Data inicial do formulário de criação (AAAA-MM-DD em America/Belem). */
export function defaultPlannedStartDate(now = new Date()): string {
  return formatIsoDateOnly(belemDateParts(now));
}

/**
 * Status inicial permitido na criação.
 * Só PLANNED (padrão) ou DONE quando o cliente marca “cadastrar como concluída”.
 * Qualquer outro valor é ignorado.
 */
export function initialStatusOnCreate(markCompleted: boolean): "PLANNED" | "DONE" {
  return markCompleted === true ? "DONE" : "PLANNED";
}

/**
 * Turma fora da Agenda. No cadastro, “inativa” e “cancelada” são o mesmo
 * valor do enum ClassGroupStatus: CANCELADA. ENCERRADA permanece visível.
 */
export const AGENDA_EXCLUDED_CLASS_GROUP_STATUSES: ClassGroupStatus[] = ["CANCELADA"];

export function isAgendaEligibleClassGroupStatus(status: string): boolean {
  return !AGENDA_EXCLUDED_CLASS_GROUP_STATUSES.includes(status as ClassGroupStatus);
}

/**
 * Filtro da Agenda: ClassSession do período (máx. 31 dias), qualquer polo,
 * exceto turmas CANCELADA. Sem teto de quantidade.
 */
export function buildClassSessionAgendaWhere(range: {
  fromUtc: Date;
  toExclusiveUtc: Date;
}): {
  sessionDate: { gte: Date; lt: Date };
  classGroup: { status: { notIn: ClassGroupStatus[] } };
} {
  return {
    sessionDate: {
      gte: range.fromUtc,
      lt: range.toExclusiveUtc,
    },
    classGroup: {
      status: { notIn: AGENDA_EXCLUDED_CLASS_GROUP_STATUSES },
    },
  };
}

export type AgendaSessionView = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  courseName: string;
  classGroupId: string;
  location: string | null;
  poloName: string | null;
  locationName: string | null;
  isExternal: boolean;
  teachers: { id: string; name: string }[];
  conflict: boolean;
};

/** Monta o card da agenda e ordena por data/horário, sem duplicar sessão. */
export function mapAgendaSessions(
  sessions: Array<{
    id: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    status: string;
    classGroup: {
      id: string;
      location: string | null;
      isExternal: boolean;
      course: { name: string };
      poloLocation: { name: string; polo: { name: string } } | null;
      teacher: { id: string; name: string };
      classGroupTeachers: { teacher: { id: string; name: string } }[];
    };
  }>,
): AgendaSessionView[] {
  const seen = new Set<string>();
  const slots: AgendaSessionView[] = [];
  for (const s of sessions) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const teachersMap = new Map<string, { id: string; name: string }>();
    teachersMap.set(s.classGroup.teacher.id, {
      id: s.classGroup.teacher.id,
      name: s.classGroup.teacher.name,
    });
    for (const t of s.classGroup.classGroupTeachers) {
      teachersMap.set(t.teacher.id, t.teacher);
    }
    slots.push({
      id: s.id,
      date: s.sessionDate.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      courseName: s.classGroup.course.name,
      classGroupId: s.classGroup.id,
      location: s.classGroup.location,
      poloName: s.classGroup.poloLocation?.polo.name ?? null,
      locationName: s.classGroup.poloLocation?.name ?? null,
      isExternal: s.classGroup.isExternal,
      teachers: [...teachersMap.values()],
      conflict: false,
    });
  }
  slots.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.id.localeCompare(b.id),
  );
  return markTeacherScheduleConflicts(slots);
}

/** Remove turmas inativas/canceladas e só então monta conflitos no conjunto restante. */
export function assembleAgendaSessions<
  T extends {
    id: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    status: string;
    classGroup: {
      id: string;
      status: string;
      location: string | null;
      isExternal: boolean;
      course: { name: string };
      poloLocation: { name: string; polo: { name: string } } | null;
      teacher: { id: string; name: string };
      classGroupTeachers: { teacher: { id: string; name: string } }[];
    };
  },
>(sessions: T[]): AgendaSessionView[] {
  return mapAgendaSessions(
    sessions.filter((session) => isAgendaEligibleClassGroupStatus(session.classGroup.status)),
  );
}

/** Horários HH:MM (ou HH:MM:SS) — sobreposição estrita de intervalos. */
export function sessionTimesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Marca conflito quando o mesmo professor aparece em duas sessões
 * não canceladas no mesmo dia com horários sobrepostos.
 */
export function markTeacherScheduleConflicts<
  T extends {
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    teachers: { id: string }[];
    conflict: boolean;
  },
>(slots: T[]): T[] {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].status === "CANCELED") continue;
    for (let j = i + 1; j < slots.length; j++) {
      if (slots[j].status === "CANCELED") continue;
      if (slots[i].date !== slots[j].date) continue;
      if (
        !sessionTimesOverlap(
          slots[i].startTime,
          slots[i].endTime,
          slots[j].startTime,
          slots[j].endTime,
        )
      ) {
        continue;
      }
      const shared = slots[i].teachers.some((t) =>
        slots[j].teachers.some((u) => u.id === t.id),
      );
      if (shared) {
        slots[i].conflict = true;
        slots[j].conflict = true;
      }
    }
  }
  return slots;
}
