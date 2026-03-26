"use client";

import { Menu } from "lucide-react";
import { useCallback, useLayoutEffect, useState } from "react";

import { DashboardShell, sessionRoleToDashboardRole } from "@/components/dashboard/DashboardUI";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const SIDEBAR_EXPANDED_KEY = "igh-panel-sidebar-expanded";

export function ResponsiveShell({
  user,
  logoUrl = null,
  children,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: "MASTER" | "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";
    baseRole?: "MASTER" | "ADMIN" | "COORDINATOR" | "TEACHER" | "STUDENT";
    isAdmin?: boolean;
    hasStudentProfile?: boolean;
    hasTeacherProfile?: boolean;
    /** Perfis disponíveis (calculado no servidor); quando presente, o select usa isso. */
    availableRoles?: {
      canMaster: boolean;
      canStudent: boolean;
      canTeacher: boolean;
      canAdmin: boolean;
      canCoordinator?: boolean;
    };
  };
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Em telas md+: menu fixo visível. Persistido para todas as páginas do painel. */
  const [sidebarExpanded, setSidebarExpandedState] = useState(true);

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
      if (raw === "false") setSidebarExpandedState(false);
    } catch {
      /* ignore */
    }
  }, []);

  const setSidebarExpanded = useCallback((next: boolean) => {
    setSidebarExpandedState(next);
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, next ? "true" : "false");
    } catch {
      /* ignore */
    }
    if (!next) setDrawerOpen(false);
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const collapseSidebar = useCallback(() => setSidebarExpanded(false), [setSidebarExpanded]);

  const expandSidebar = useCallback(() => {
    setSidebarExpanded(true);
    setDrawerOpen(false);
  }, [setSidebarExpanded]);

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/50"
          onClick={closeDrawer}
        />
      )}
      <Sidebar
        user={user}
        logoUrl={logoUrl}
        drawerOpen={drawerOpen}
        onDrawerClose={closeDrawer}
        sidebarExpanded={sidebarExpanded}
        onSidebarCollapse={collapseSidebar}
        onSidebarExpand={expandSidebar}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-1">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`rounded p-2 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] ${sidebarExpanded ? "md:hidden" : ""}`}
            aria-label="Abrir menu"
            title="Abrir menu"
          >
            <Menu className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
          </button>
          <div className="min-w-0 flex-1" aria-hidden />
          <TopBar user={user} />
        </header>
        <main className="min-h-0 flex-1" data-main-plain-lists="true">
          <DashboardShell role={sessionRoleToDashboardRole(user.role)}>
            <div className="container-page">{children}</div>
          </DashboardShell>
        </main>
      </div>
    </div>
  );
}
