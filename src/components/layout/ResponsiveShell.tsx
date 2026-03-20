"use client";

import { useState } from "react";

import { DashboardShell, sessionRoleToDashboardRole } from "@/components/dashboard/DashboardUI";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function ResponsiveShell({
  user,
  logoUrl = null,
  children,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";
    baseRole?: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT";
    isAdmin?: boolean;
    hasStudentProfile?: boolean;
    hasTeacherProfile?: boolean;
    /** Perfis disponíveis (calculado no servidor); quando presente, o select usa isso. */
    availableRoles?: { canMaster: boolean; canStudent: boolean; canTeacher: boolean; canAdmin: boolean };
  };
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Overlay no mobile quando menu aberto */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar
        user={user}
        logoUrl={logoUrl}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded p-2 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] md:hidden"
            aria-label="Abrir menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
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
