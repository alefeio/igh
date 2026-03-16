"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import { playNotificationSound } from "@/lib/notification-sound";

type RoleOption = { value: "STUDENT" | "TEACHER" | "ADMIN" | "MASTER"; label: string };

export function TopBar({
  user,
}: {
  user: {
    name: string;
    email: string;
    role: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";
    baseRole?: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";
    isAdmin?: boolean;
    hasStudentProfile?: boolean;
    hasTeacherProfile?: boolean;
    availableRoles?: { canMaster: boolean; canStudent: boolean; canTeacher: boolean; canAdmin: boolean };
  };
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [supportBadge, setSupportBadge] = useState<{ unreadCount?: number; openCount?: number }>({});
  const [notificationBadge, setNotificationBadge] = useState<{ hasUnread?: boolean }>({});

  const isSupport =
    user.role === "MASTER" ||
    user.role === "ADMIN" ||
    user.baseRole === "MASTER" ||
    user.baseRole === "ADMIN" ||
    user.isAdmin;

  const fetchSupportBadge = useCallback(() => {
    fetch("/api/me/support/badge", { credentials: "include" })
      .then((r) =>
        r.json() as Promise<ApiResponse<{ unreadCount?: number; openCount?: number }>>
      )
      .then((json) => {
        if (json?.ok && json.data) setSupportBadge(json.data);
      })
      .catch(() => {});
  }, []);

  const isSupportRef = useRef(isSupport);
  isSupportRef.current = isSupport;

  useEffect(() => {
    fetchSupportBadge();

    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/support`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        fetchSupportBadge();
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { type?: string; audience?: string };
          if (data.type !== "support_badge") return;
          const audience = data.audience ?? "all";
          const support = isSupportRef.current;
          const shouldRefetch =
            audience === "all" ||
            (audience === "student" && !support) ||
            (audience === "admin" && support);
          const isNewMessage = audience === "student" || audience === "admin";
          if (shouldRefetch) {
            setTimeout(() => {
              fetchSupportBadge();
              if (isNewMessage) playNotificationSound();
            }, 0);
          }
        } catch {
          // ignorar mensagem inválida
        }
      };
      ws.onclose = () => {
        ws = null;
        reconnectTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [fetchSupportBadge]);

  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchSupportBadge();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const onRefetch = () => fetchSupportBadge();
    window.addEventListener("support-badge-refetch", onRefetch);
    return () => window.removeEventListener("support-badge-refetch", onRefetch);
  }, [fetchSupportBadge]);

  useEffect(() => {
    fetch("/api/me/notifications/badge", { credentials: "include" })
      .then((r) => r.json() as Promise<ApiResponse<{ hasUnread?: boolean }>>)
      .then((json) => {
        if (json?.ok && json.data) setNotificationBadge(json.data);
      })
      .catch(() => {});
  }, []);

  const r = user.availableRoles;
  const canMaster = r?.canMaster ?? (user.baseRole === "MASTER");
  const canStudent = r?.canStudent ?? (user.hasStudentProfile === true);
  const canTeacher = r?.canTeacher ?? (user.hasTeacherProfile === true);
  const canAdmin = r?.canAdmin ?? (user.isAdmin === true || user.baseRole === "ADMIN");

  const roleLabels: Record<string, string> = {
    MASTER: "Administrador Master",
    ADMIN: "Admin",
    TEACHER: "Professor",
    STUDENT: "Aluno",
  };

  let roleOptions: RoleOption[] = [
    ...(canMaster ? [{ value: "MASTER" as const, label: roleLabels.MASTER }] : []),
    ...(canStudent ? [{ value: "STUDENT" as const, label: roleLabels.STUDENT }] : []),
    ...(canTeacher ? [{ value: "TEACHER" as const, label: roleLabels.TEACHER }] : []),
    ...(canAdmin ? [{ value: "ADMIN" as const, label: roleLabels.ADMIN }] : []),
  ];
  if (!roleOptions.some((o) => o.value === user.role)) {
    roleOptions = [...roleOptions, { value: user.role as RoleOption["value"], label: roleLabels[user.role] ?? user.role }];
  }
  const hasMoreThanOneProfile = roleOptions.length >= 2;

  async function onRoleChange(newRole: "STUDENT" | "TEACHER" | "ADMIN" | "MASTER") {
    if (newRole === user.role) return;
    setSwitchingRole(true);
    try {
      const res = await fetch("/api/auth/choose-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSwitchingRole(false);
    }
  }

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2">
      <div className="relative flex items-center gap-2">
        <ThemeToggle aria-label="Alternar tema" />
        {/* Ícone de notificações gerais (sino) */}
        <span className="relative inline-flex">
          <Link
            href="/notificacoes"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2"
            title="Notificações"
            aria-label="Notificações"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </Link>
          {notificationBadge.hasUnread && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[var(--card-bg)]"
              aria-hidden
              title="Novas notificações"
            />
          )}
        </span>
        {/* Ícone de suporte com bolinha verde para respostas/abertos */}
        <span className="relative inline-flex">
          <Link
            href="/suporte"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2"
            title="Suporte técnico"
            aria-label="Suporte técnico"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </Link>
          {/* Aluno: bolinha quando tem resposta nova */}
          {!isSupport && (supportBadge.unreadCount ?? 0) > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[var(--card-bg)]"
              aria-hidden
              title="Nova resposta no suporte"
            />
          )}
          {/* Admin/Master: badge numérico para chamados em aberto */}
          {isSupport && supportBadge.openCount != null && supportBadge.openCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--card-bg)]"
              aria-label={`${supportBadge.openCount} chamado(s) novo(s)`}
            >
              {supportBadge.openCount > 99 ? "99+" : supportBadge.openCount}
            </span>
          )}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Abrir menu do usuário"
          >
            <span className="hidden max-w-[120px] truncate sm:inline" title={user.name}>
              {user.name}
            </span>
            <svg className="h-4 w-4 shrink-0 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-lg"
                role="menu"
              >
                <div className="border-b border-[var(--card-border)] pb-3">
                  <p className="truncate font-medium text-[var(--text-primary)]" title={user.name}>
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]" title={user.email}>
                    {user.email}
                  </p>
                </div>
                {hasMoreThanOneProfile && (
                  <div className="border-b border-[var(--card-border)] py-3">
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Perfil</label>
                    <select
                      value={user.role}
                      disabled={switchingRole}
                      onChange={(e) => onRoleChange(e.target.value as "STUDENT" | "TEACHER" | "ADMIN" | "MASTER")}
                      className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--input-text)] focus:border-[var(--igh-primary)] focus:outline-none"
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="border-b border-[var(--card-border)] py-3">
                  <p className="mb-1 text-xs font-medium text-[var(--text-muted)]">Tema</p>
                  <ThemeToggle showLabel className="w-full justify-start" />
                </div>
                <ul className="list-none space-y-0.5 py-3 pl-0">
                  <li>
                    <Link
                      href="/"
                      className="block rounded-md px-2 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Acessar site
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/meus-dados"
                      className="block rounded-md px-2 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Meus dados
                    </Link>
                  </li>
                </ul>
                <div className="pt-2">
                  <Button variant="secondary" className="w-full" onClick={logout} disabled={loading}>
                    Sair
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
