"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";
import {
  BOARD_ACTIVITY_STATUS_LABEL,
  BOARD_REACTION_EMOJIS,
  addCalendarDays,
  belemDateParts,
  canMoveBoardActivity,
  canTransitionStatus,
  defaultPlannedStartDate,
  formatIsoDateOnly,
  initialStatusOnCreate,
  isMasterOrAdminRole,
  startOfWeekMondayBelem,
  type BoardReactionEmoji,
} from "@/lib/board-activities";

type BoardStatus = "PLANNED" | "IN_PROGRESS" | "DONE";
type TabId = "atividades" | "agenda";

type AssigneeOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ActivityCard = {
  id: string;
  title: string;
  status: BoardStatus;
  plannedStartAt: string;
  plannedEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  creatorId: string;
  assigneeId: string;
  assignee: { id: string; name: string };
  version: number;
  createdAt: string;
  commentCount: number;
  reactionCount: number;
  overdue: boolean;
};

type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  status: BoardStatus;
  plannedStartAt: string;
  plannedEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  version: number;
  creator: { id: string; name: string; email: string; isActive: boolean };
  assignee: { id: string; name: string; email: string; isActive: boolean };
  overdue: boolean;
  canMove: boolean;
  canEdit: boolean;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    author: { id: string; name: string };
    canEdit: boolean;
  }>;
  reactions: Array<{
    id: string;
    emoji: string;
    userId: string;
    userName: string;
    mine: boolean;
  }>;
  events: Array<{
    id: string;
    type: string;
    payload: unknown;
    createdAt: string;
    actor: { id: string; name: string };
  }>;
  commentCount: number;
  reactionCount: number;
};

type AgendaSession = {
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

type CreatePermissionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  canCreateBoardTasks: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  MASTER: "Master",
  GENERAL_ADMIN: "Admin geral",
  ADMIN: "Administrador",
  ADMIN_MANAGER: "Gerente admin",
  SITE_ADMIN: "Admin do site",
  POLO_COORDINATOR: "Coord. de polo",
  DIRECTOR: "Diretor",
  TEACHER: "Professor",
};

const STATUSES: BoardStatus[] = ["PLANNED", "IN_PROGRESS", "DONE"];

function isoToDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function formatDateBr(isoOrDate: string): string {
  const d = isoOrDate.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return isoOrDate;
  return `${day}/${m}/${y}`;
}

function formatPlannedRange(startIso: string, endIso: string | null): string {
  const start = formatDateBr(startIso);
  if (!endIso || isoToDateOnly(endIso) === isoToDateOnly(startIso)) return start;
  return `${start} – ${formatDateBr(endIso)}`;
}

function initialOf(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

function moveLabel(to: BoardStatus): string {
  if (to === "PLANNED") return "Mover para Planejadas";
  if (to === "IN_PROGRESS") return "Mover para Em andamento";
  return "Marcar como concluída";
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    CREATED: "Criada",
    STATUS_CHANGED: "Situação alterada",
    REOPENED: "Reaberta",
    ASSIGNEE_CHANGED: "Responsável alterado",
    PLANNED_PERIOD_CHANGED: "Período planejado alterado",
    ARCHIVED: "Arquivada",
    ADMIN_REASSIGNED: "Reassociada (admin)",
  };
  return map[type] ?? type;
}

async function parseJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

function DraggableCard({
  activity,
  canDrag,
  onOpen,
}: {
  activity: ActivityCard;
  canDrag: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    disabled: !canDrag,
    data: { status: activity.status },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-sm transition ${
        isDragging ? "opacity-40" : ""
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      onClick={() => onOpen(activity.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(activity.id);
        }
      }}
    >
      <CardBody activity={activity} />
    </div>
  );
}

function CardBody({ activity }: { activity: ActivityCard }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--igh-primary)]/15 text-xs font-bold text-[var(--igh-primary)]"
          title={activity.assignee.name}
          aria-hidden
        >
          {initialOf(activity.assignee.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{activity.title}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{activity.assignee.name}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        {formatPlannedRange(activity.plannedStartAt, activity.plannedEndAt)}
      </p>
      {activity.overdue ? (
        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">Atrasada</p>
      ) : null}
      <div className="mt-2 flex gap-3 text-[11px] text-[var(--text-muted)]">
        <span>{activity.commentCount} comentário{activity.commentCount === 1 ? "" : "s"}</span>
        <span>{activity.reactionCount} reação{activity.reactionCount === 1 ? "" : "ões"}</span>
      </div>
    </>
  );
}

function DropColumn({
  status,
  count,
  children,
}: {
  status: BoardStatus;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[280px] flex-col rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-3 ${
        isOver ? "ring-2 ring-[var(--igh-primary)]/40" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {BOARD_ACTIVITY_STATUS_LABEL[status]}
        </h3>
        <span className="rounded-md bg-[var(--card-bg)] px-2 py-0.5 text-xs tabular-nums text-[var(--text-muted)]">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function GestaoAtividadesClient() {
  const user = useUser();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = useMemo(() => formatIsoDateOnly(belemDateParts()), []);
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || from;
  const mine = searchParams.get("mine") === "1";
  const assigneeId = searchParams.get("assigneeId") || "";
  const q = searchParams.get("q") || "";
  const tab = (searchParams.get("tab") === "agenda" ? "agenda" : "atividades") as TabId;
  const taskId = searchParams.get("task") || "";

  const [activities, setActivities] = useState<ActivityCard[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(user.id);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mobileStatus, setMobileStatus] = useState<BoardStatus>("PLANNED");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createAssignee, setCreateAssignee] = useState("");
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const [createAsCompleted, setCreateAsCompleted] = useState(false);
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [moving, setMoving] = useState(false);

  const [agenda, setAgenda] = useState<AgendaSession[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [searchDraft, setSearchDraft] = useState(q);

  const canManageCreatePerms = isMasterOrAdminRole(user.role);
  const [permsOpen, setPermsOpen] = useState(false);
  const [permsQ, setPermsQ] = useState("");
  const [permsUsers, setPermsUsers] = useState<CreatePermissionUser[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsError, setPermsError] = useState<string | null>(null);
  const [permsSavingId, setPermsSavingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `/gestao/atividades?${qs}` : "/gestao/atividades");
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (user.role === "STUDENT") router.replace("/dashboard");
  }, [user.role, router]);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const loadAssignees = useCallback(async () => {
    const res = await fetch("/api/gestao/atividades/assignees");
    const json = await parseJson<{ assignees: AssigneeOption[] }>(res);
    if (json?.ok) setAssignees(json.data.assignees);
  }, []);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ from, to });
    if (mine) params.set("mine", "1");
    if (assigneeId) params.set("assigneeId", assigneeId);
    if (q.trim()) params.set("q", q.trim());
    try {
      const res = await fetch(`/api/gestao/atividades?${params}`);
      const json = await parseJson<{
        canCreate: boolean;
        currentUserId: string;
        activities: ActivityCard[];
      }>(res);
      if (!json?.ok) {
        setLoadError(json && !json.ok ? json.error.message : "Falha ao carregar atividades.");
        setActivities([]);
        return;
      }
      setCanCreate(json.data.canCreate);
      setCurrentUserId(json.data.currentUserId);
      setActivities(json.data.activities);
    } catch {
      setLoadError("Falha de rede ao carregar atividades.");
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, mine, assigneeId, q]);

  const loadAgenda = useCallback(async () => {
    setAgendaLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (teacherFilter.trim()) params.set("teacher", teacherFilter.trim());
      const res = await fetch(`/api/gestao/atividades/agenda?${params}`);
      const json = await parseJson<{ sessions: AgendaSession[] }>(res);
      if (!json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Falha ao carregar agenda.");
        setAgenda([]);
        return;
      }
      setAgenda(json.data.sessions);
    } catch {
      toast.push("error", "Falha de rede ao carregar agenda.");
      setAgenda([]);
    } finally {
      setAgendaLoading(false);
    }
  }, [from, to, teacherFilter, toast]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/gestao/atividades/${id}`);
        const json = await parseJson<{ activity: ActivityDetail }>(res);
        if (!json?.ok) {
          toast.push("error", json && !json.ok ? json.error.message : "Atividade não encontrada.");
          setDetail(null);
          setParams({ task: null });
          return;
        }
        setDetail(json.data.activity);
      } catch {
        toast.push("error", "Falha ao abrir a atividade.");
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [setParams, toast],
  );

  const loadCreatePermissions = useCallback(async (search: string) => {
    setPermsLoading(true);
    setPermsError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      const res = await fetch(`/api/gestao/atividades/create-permissions${qs ? `?${qs}` : ""}`);
      const json = await parseJson<{ users: CreatePermissionUser[] }>(res);
      if (!json?.ok) {
        setPermsError(json && !json.ok ? json.error.message : "Falha ao carregar permissões.");
        setPermsUsers([]);
        return;
      }
      setPermsUsers(json.data.users);
    } catch {
      setPermsError("Falha de rede ao carregar permissões.");
      setPermsUsers([]);
    } finally {
      setPermsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permsOpen) return;
    const t = window.setTimeout(() => {
      void loadCreatePermissions(permsQ);
    }, 250);
    return () => window.clearTimeout(t);
  }, [permsOpen, permsQ, loadCreatePermissions]);

  const toggleCreatePermission = async (target: CreatePermissionUser, next: boolean) => {
    setPermsSavingId(target.id);
    try {
      const res = await fetch(`/api/gestao/atividades/create-permission/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canCreateBoardTasks: next }),
      });
      const json = await parseJson<{ user: { id: string; canCreateBoardTasks: boolean } }>(res);
      if (!json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível salvar.");
        return;
      }
      setPermsUsers((prev) =>
        prev.map((u) =>
          u.id === target.id ? { ...u, canCreateBoardTasks: json.data.user.canCreateBoardTasks } : u,
        ),
      );
      toast.push("success", next ? "Permissão concedida." : "Permissão removida.");
      if (target.id === user.id) setCanCreate(json.data.user.canCreateBoardTasks);
    } catch {
      toast.push("error", "Falha de rede ao salvar permissão.");
    } finally {
      setPermsSavingId(null);
    }
  };

  useEffect(() => {
    if (user.role === "STUDENT") return;
    void loadAssignees();
  }, [user.role, loadAssignees]);

  useEffect(() => {
    if (user.role === "STUDENT") return;
    if (tab === "atividades") void loadActivities();
  }, [user.role, tab, loadActivities]);

  useEffect(() => {
    if (user.role === "STUDENT") return;
    if (tab === "agenda") void loadAgenda();
  }, [user.role, tab, loadAgenda]);

  useEffect(() => {
    if (user.role === "STUDENT") return;
    if (taskId) void loadDetail(taskId);
    else setDetail(null);
  }, [user.role, taskId, loadDetail]);

  const byStatus = useMemo(() => {
    const map: Record<BoardStatus, ActivityCard[]> = {
      PLANNED: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const a of activities) map[a.status].push(a);
    return map;
  }, [activities]);

  const activeDrag = useMemo(
    () => activities.find((a) => a.id === activeDragId) ?? null,
    [activities, activeDragId],
  );

  const canDragActivity = useCallback(
    (a: ActivityCard) =>
      canMoveBoardActivity({
        actorId: currentUserId,
        creatorId: a.creatorId,
        assigneeId: a.assigneeId,
      }),
    [currentUserId],
  );

  const applyLocalStatus = useCallback((id: string, status: BoardStatus, version?: number) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              version: version ?? a.version + 1,
              overdue: status === "DONE" ? false : a.overdue,
            }
          : a,
      ),
    );
  }, []);

  const moveActivity = useCallback(
    async (id: string, nextStatus: BoardStatus, previous?: ActivityCard) => {
      const card = previous ?? activities.find((a) => a.id === id);
      if (!card || card.status === nextStatus) return;
      if (!canTransitionStatus(card.status, nextStatus)) {
        toast.push("error", "Essa mudança de situação não é permitida.");
        return;
      }
      if (!canDragActivity(card)) {
        toast.push("error", "Somente quem criou ou o responsável pode mudar o status.");
        return;
      }

      const snapshot = { ...card };
      applyLocalStatus(id, nextStatus);
      setMoving(true);
      try {
        const res = await fetch(`/api/gestao/atividades/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus, version: card.version }),
        });
        const json = await parseJson<{
          activity: { id: string; status: BoardStatus; version: number };
        }>(res);
        if (!json?.ok) {
          setActivities((prev) => prev.map((a) => (a.id === id ? snapshot : a)));
          toast.push("error", json && !json.ok ? json.error.message : "Não foi possível mover.");
          return;
        }
        applyLocalStatus(id, json.data.activity.status, json.data.activity.version);
        if (detail?.id === id) void loadDetail(id);
        toast.push("success", "Situação atualizada.");
      } catch {
        setActivities((prev) => prev.map((a) => (a.id === id ? snapshot : a)));
        toast.push("error", "Falha de rede ao mover a atividade.");
      } finally {
        setMoving(false);
      }
    },
    [activities, applyLocalStatus, canDragActivity, detail?.id, loadDetail, toast],
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const nextStatus = String(overId) as BoardStatus;
    if (!STATUSES.includes(nextStatus)) return;
    const card = activities.find((a) => a.id === String(e.active.id));
    if (!card) return;
    void moveActivity(card.id, nextStatus, card);
  };

  const openTask = (id: string) => setParams({ task: id });
  const closeTask = () => {
    setParams({ task: null });
    setDetail(null);
    setCommentBody("");
  };

  const applyPeriodPreset = (preset: "hoje" | "amanha" | "semana" | "limpar") => {
    const t = belemDateParts();
    if (preset === "hoje" || preset === "limpar") {
      const d = formatIsoDateOnly(t);
      setParams({ from: d, to: d });
      return;
    }
    if (preset === "amanha") {
      const d = formatIsoDateOnly(addCalendarDays(t, 1));
      setParams({ from: d, to: d });
      return;
    }
    const mon = startOfWeekMondayBelem();
    const sun = addCalendarDays(mon, 6);
    setParams({ from: formatIsoDateOnly(mon), to: formatIsoDateOnly(sun) });
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createAssignee) {
      toast.push("error", "Informe título e responsável.");
      return;
    }
    setCreating(true);
    const status = initialStatusOnCreate(createAsCompleted);
    try {
      const res = await fetch("/api/gestao/atividades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDesc.trim() || null,
          assigneeId: createAssignee,
          plannedStartAt: createStart,
          plannedEndAt: createEnd || null,
          markCompleted: createAsCompleted,
        }),
      });
      const json = await parseJson<{ activity: ActivityCard }>(res);
      if (!json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível criar.");
        return;
      }
      toast.push("success", status === "DONE" ? "Atividade cadastrada como concluída." : "Atividade criada.");
      setCreateOpen(false);
      setCreateTitle("");
      setCreateDesc("");
      setCreateAssignee("");
      setCreateStart(defaultPlannedStartDate());
      setCreateEnd("");
      setCreateAsCompleted(false);
      void loadActivities();
      openTask(json.data.activity.id);
    } catch {
      toast.push("error", "Falha de rede ao criar.");
    } finally {
      setCreating(false);
    }
  };

  const toggleReaction = async (emoji: BoardReactionEmoji) => {
    if (!detail) return;
    const res = await fetch(`/api/gestao/atividades/${detail.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const json = await parseJson<{ added?: boolean; removed?: boolean }>(res);
    if (!json?.ok) {
      toast.push("error", json && !json.ok ? json.error.message : "Falha na reação.");
      return;
    }
    void loadDetail(detail.id);
    void loadActivities();
  };

  const submitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail || !commentBody.trim()) return;
    setCommenting(true);
    try {
      const res = await fetch(`/api/gestao/atividades/${detail.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      const json = await parseJson<{ comment: ActivityDetail["comments"][number] }>(res);
      if (!json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Falha ao comentar.");
        return;
      }
      setCommentBody("");
      void loadDetail(detail.id);
      void loadActivities();
    } catch {
      toast.push("error", "Falha de rede ao comentar.");
    } finally {
      setCommenting(false);
    }
  };

  const archiveActivity = async () => {
    if (!detail || detail.status !== "DONE" || !detail.canEdit) return;
    if (!window.confirm("Arquivar esta atividade concluída?")) return;
    const res = await fetch(`/api/gestao/atividades/${detail.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    const json = await parseJson<{ archived: boolean }>(res);
    if (!json?.ok) {
      toast.push("error", json && !json.ok ? json.error.message : "Não foi possível arquivar.");
      return;
    }
    toast.push("success", "Atividade arquivada.");
    closeTask();
    void loadActivities();
  };

  const agendaByDate = useMemo(() => {
    const map = new Map<string, AgendaSession[]>();
    for (const s of agenda) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return [...map.entries()];
  }, [agenda]);

  if (user.role === "STUDENT") {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">Redirecionando…</div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <DashboardHero
        title="Quadro de Atividades"
        description="Acompanhe o que está planejado, em andamento e concluído."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {canManageCreatePerms ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPermsOpen(true);
                  setPermsQ("");
                }}
              >
                Quem pode criar atividades
              </Button>
            ) : null}
            {canCreate ? (
              <Button
                type="button"
                onClick={() => {
                  setCreateTitle("");
                  setCreateDesc("");
                  setCreateAssignee("");
                  setCreateStart(defaultPlannedStartDate());
                  setCreateEnd("");
                  setCreateAsCompleted(false);
                  setCreateOpen(true);
                }}
              >
                Nova atividade
              </Button>
            ) : null}
          </div>
        }
      />

      <SectionCard title="Período" description="Filtro compartilhado entre Atividades e Agenda.">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => applyPeriodPreset("hoje")}>
            Hoje
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => applyPeriodPreset("amanha")}>
            Amanhã
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => applyPeriodPreset("semana")}>
            Esta semana
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => applyPeriodPreset("limpar")}>
            Limpar
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-[var(--text-muted)]">
            De
            <Input
              type="date"
              value={from}
              onChange={(e) => setParams({ from: e.target.value, to: to < e.target.value ? e.target.value : to })}
            />
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-[var(--text-muted)]">
            Até
            <Input
              type="date"
              value={to}
              onChange={(e) => setParams({ to: e.target.value, from: from > e.target.value ? e.target.value : from })}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Exibindo de {formatDateBr(from)} até {formatDateBr(to)} (fuso Belém).
        </p>
      </SectionCard>

      <div className="flex gap-2 border-b border-[var(--card-border)]">
        <button
          type="button"
          className={`cursor-pointer px-3 py-2 text-sm font-medium ${
            tab === "atividades"
              ? "border-b-2 border-[var(--igh-primary)] text-[var(--igh-primary)]"
              : "text-[var(--text-muted)]"
          }`}
          onClick={() => setParams({ tab: null })}
        >
          Atividades
        </button>
        <button
          type="button"
          className={`cursor-pointer px-3 py-2 text-sm font-medium ${
            tab === "agenda"
              ? "border-b-2 border-[var(--igh-primary)] text-[var(--igh-primary)]"
              : "text-[var(--text-muted)]"
          }`}
          onClick={() => setParams({ tab: "agenda" })}
        >
          Agenda dos professores
        </button>
      </div>

      {tab === "atividades" ? (
        <>
          <SectionCard title="Filtros" description="Ajuste a lista sem perder o período.">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={mine}
                  onChange={(e) => setParams({ mine: e.target.checked ? "1" : null })}
                />
                Minhas atividades
              </label>
              <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-[var(--text-muted)]">
                Responsável
                <select
                  className="theme-input min-h-[44px] w-full rounded-md border px-3 text-sm sm:h-10 sm:min-h-0"
                  value={assigneeId}
                  onChange={(e) => setParams({ assigneeId: e.target.value || null })}
                >
                  <option value="">Todos</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[180px] flex-[2] flex-col gap-1 text-xs text-[var(--text-muted)]">
                Buscar título
                <div className="flex gap-2">
                  <Input
                    value={searchDraft}
                    placeholder="Palavra no título…"
                    onChange={(e) => setSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setParams({ q: searchDraft.trim() || null });
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setParams({ q: searchDraft.trim() || null })}
                  >
                    Buscar
                  </Button>
                </div>
              </label>
            </div>
          </SectionCard>

          {loadError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          ) : null}
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando atividades…</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma atividade neste período.</p>
          ) : (
            <>
              {/* Desktop board */}
              <div className="hidden md:block">
                <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                  <div className="grid grid-cols-3 gap-4">
                    {STATUSES.map((status) => (
                      <DropColumn key={status} status={status} count={byStatus[status].length}>
                        {byStatus[status].map((a) => (
                          <DraggableCard
                            key={a.id}
                            activity={a}
                            canDrag={canDragActivity(a)}
                            onOpen={openTask}
                          />
                        ))}
                      </DropColumn>
                    ))}
                  </div>
                  <DragOverlay>
                    {activeDrag ? (
                      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-lg">
                        <CardBody activity={activeDrag} />
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>

              {/* Mobile: status tabs + list */}
              <div className="md:hidden">
                <div className="mb-3 flex gap-1 overflow-x-auto">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`cursor-pointer shrink-0 rounded-md px-3 py-2 text-xs font-medium ${
                        mobileStatus === s
                          ? "bg-[var(--igh-primary)] text-white"
                          : "bg-[var(--igh-surface)] text-[var(--text-secondary)]"
                      }`}
                      onClick={() => setMobileStatus(s)}
                    >
                      {BOARD_ACTIVITY_STATUS_LABEL[s]} ({byStatus[s].length})
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  {byStatus[mobileStatus].map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
                    >
                      <button type="button" className="w-full cursor-pointer text-left" onClick={() => openTask(a.id)}>
                        <CardBody activity={a} />
                      </button>
                      {canDragActivity(a) ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {STATUSES.filter((s) => s !== a.status && canTransitionStatus(a.status, s)).map(
                            (s) => (
                              <Button
                                key={s}
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={moving}
                                onClick={() => void moveActivity(a.id, s, a)}
                              >
                                {moveLabel(s)}
                              </Button>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {byStatus[mobileStatus].length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">Nenhuma nesta situação.</p>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <SectionCard title="Agenda dos professores" description="Somente leitura, a partir das aulas cadastradas.">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Filtrar por professor…"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadAgenda();
              }}
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => void loadAgenda()}>
              Filtrar
            </Button>
          </div>
          {agendaLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando agenda…</p>
          ) : agenda.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma aula neste período.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {agendaByDate.map(([date, sessions]) => (
                <div key={date}>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                    {formatDateBr(date)}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {sessions.map((s) => (
                      <li
                        key={s.id}
                        className={`rounded-lg border p-3 text-sm ${
                          s.status === "CANCELED"
                            ? "border-zinc-300 bg-zinc-100/60 text-[var(--text-muted)] line-through dark:border-zinc-600 dark:bg-zinc-800/40"
                            : s.conflict
                              ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20"
                              : "border-[var(--card-border)] bg-[var(--card-bg)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium text-[var(--text-primary)] no-underline">
                            {s.startTime} – {s.endTime}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-[var(--text-muted)] no-underline">
                            {s.status === "CANCELED" ? "Cancelada" : s.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[var(--text-primary)] no-underline">{s.courseName}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)] no-underline">
                          {s.teachers.map((t) => t.name).join(", ")}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)] no-underline">
                          {[s.poloName, s.locationName, s.location].filter(Boolean).join(" · ") || "Local não informado"}
                          {" · "}
                          {s.isExternal ? "Externa" : "Interna"}
                        </p>
                        {s.conflict && s.status !== "CANCELED" ? (
                          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400 no-underline">
                            Possível conflito de horário
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <Modal
        open={permsOpen}
        onClose={() => setPermsOpen(false)}
        title="Quem pode criar atividades"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Habilite profissionais internos elegíveis, inclusive professores.
          </p>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Buscar por nome ou e-mail
            <Input
              value={permsQ}
              onChange={(e) => setPermsQ(e.target.value)}
              placeholder="Digite para filtrar…"
              autoFocus
            />
          </label>
          {permsLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : permsError ? (
            <p className="text-sm text-[var(--danger)]">{permsError}</p>
          ) : permsUsers.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum profissional encontrado.</p>
          ) : (
            <ul className="max-h-[min(60vh,420px)] divide-y divide-[var(--card-border)] overflow-y-auto">
              {permsUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{u.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {ROLE_LABEL[u.role] ?? u.role}
                      {" · "}
                      {u.isActive ? "Ativo" : "Inativo"}
                      {" · "}
                      {u.email}
                    </p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--igh-primary)]"
                      checked={u.canCreateBoardTasks}
                      disabled={permsSavingId === u.id || !u.isActive}
                      onChange={(e) => void toggleCreatePermission(u, e.target.checked)}
                    />
                    Pode criar
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        open={createOpen}
        title="Nova atividade"
        onClose={() => {
          setCreateOpen(false);
          setCreateTitle("");
          setCreateDesc("");
          setCreateAssignee("");
          setCreateStart(defaultPlannedStartDate());
          setCreateEnd("");
          setCreateAsCompleted(false);
        }}
        size="small"
      >
        <form className="flex flex-col gap-3" onSubmit={submitCreate}>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Título *
            <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} required maxLength={200} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Descrição
            <textarea
              className="theme-input min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              maxLength={5000}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Responsável *
            <select
              className="theme-input min-h-[44px] w-full rounded-md border px-3 text-sm sm:h-10 sm:min-h-0"
              value={createAssignee}
              onChange={(e) => setCreateAssignee(e.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              Início planejado *
              <Input type="date" value={createStart} onChange={(e) => setCreateStart(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              Fim planejado
              <Input type="date" value={createEnd} onChange={(e) => setCreateEnd(e.target.value)} />
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--igh-primary)]"
              checked={createAsCompleted}
              onChange={(e) => setCreateAsCompleted(e.target.checked)}
            />
            <span>Cadastrar como concluída</span>
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreateOpen(false);
                setCreateTitle("");
                setCreateDesc("");
                setCreateAssignee("");
                setCreateStart(defaultPlannedStartDate());
                setCreateEnd("");
                setCreateAsCompleted(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Salvando…" : "Criar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(taskId)}
        title={detail?.title ?? (detailLoading ? "Carregando…" : "Atividade")}
        onClose={closeTask}
      >
        {detailLoading && !detail ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando detalhes…</p>
        ) : detail ? (
          <div className="flex flex-col gap-5">
            <div className="grid gap-2 text-sm">
              <p>
                <span className="text-[var(--text-muted)]">Situação: </span>
                {BOARD_ACTIVITY_STATUS_LABEL[detail.status]}
                {detail.overdue ? (
                  <span className="ml-2 font-medium text-red-600 dark:text-red-400">Atrasada</span>
                ) : null}
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Criador: </span>
                {detail.creator.name}
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Responsável: </span>
                {detail.assignee.name}
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Planejado: </span>
                {formatPlannedRange(detail.plannedStartAt, detail.plannedEndAt)}
              </p>
              {detail.startedAt ? (
                <p>
                  <span className="text-[var(--text-muted)]">Início real: </span>
                  {formatDateBr(detail.startedAt)}
                </p>
              ) : null}
              {detail.completedAt ? (
                <p>
                  <span className="text-[var(--text-muted)]">Conclusão: </span>
                  {formatDateBr(detail.completedAt)}
                </p>
              ) : null}
              {detail.description ? (
                <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{detail.description}</p>
              ) : (
                <p className="text-[var(--text-muted)]">Sem descrição.</p>
              )}
            </div>

            {detail.canMove ? (
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== detail.status && canTransitionStatus(detail.status, s)).map(
                  (s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={moving}
                      onClick={() => void moveActivity(detail.id, s)}
                    >
                      {moveLabel(s)}
                    </Button>
                  ),
                )}
              </div>
            ) : null}

            {detail.status === "DONE" && detail.canEdit ? (
              <Button type="button" size="sm" variant="danger" onClick={() => void archiveActivity()}>
                Arquivar
              </Button>
            ) : null}

            <div>
              <h4 className="mb-2 text-sm font-semibold">Reações</h4>
              <div className="flex flex-wrap gap-2">
                {BOARD_REACTION_EMOJIS.map((emoji) => {
                  const mineCount = detail.reactions.filter((r) => r.emoji === emoji && r.mine).length;
                  const total = detail.reactions.filter((r) => r.emoji === emoji).length;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-sm ${
                        mineCount
                          ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10"
                          : "border-[var(--card-border)]"
                      }`}
                      onClick={() => void toggleReaction(emoji)}
                      aria-pressed={mineCount > 0}
                    >
                      {emoji} {total > 0 ? total : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Comentários</h4>
              <ul className="mb-3 flex max-h-48 flex-col gap-2 overflow-y-auto">
                {detail.comments.length === 0 ? (
                  <li className="text-sm text-[var(--text-muted)]">Nenhum comentário ainda.</li>
                ) : (
                  detail.comments.map((c) => (
                    <li key={c.id} className="rounded-md border border-[var(--card-border)] p-2 text-sm">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        {c.author.name} · {formatDateBr(c.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{c.body}</p>
                    </li>
                  ))
                )}
              </ul>
              <form className="flex flex-col gap-2" onSubmit={submitComment}>
                <textarea
                  className="theme-input min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Escreva um comentário…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  maxLength={2000}
                />
                <Button type="submit" size="sm" disabled={commenting || !commentBody.trim()}>
                  {commenting ? "Enviando…" : "Comentar"}
                </Button>
              </form>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Histórico</h4>
              <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto text-xs text-[var(--text-muted)]">
                {detail.events.map((ev) => (
                  <li key={ev.id}>
                    {formatDateBr(ev.createdAt)} — {ev.actor.name}: {eventLabel(ev.type)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Atividade não encontrada.</p>
        )}
      </Modal>
    </div>
  );
}
