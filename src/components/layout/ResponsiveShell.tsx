"use client";

import { useState } from "react";

import { Sidebar } from "./Sidebar";

export function ResponsiveShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: "MASTER" | "ADMIN" | "TEACHER" | "STUDENT" };
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-50">
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
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded p-2 text-zinc-600 hover:bg-zinc-100"
            aria-label="Abrir menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="truncate text-sm font-semibold">Cadastro de Cursos</span>
        </header>
        <main className="min-h-0 flex-1">
          <div className="container-page">{children}</div>
        </main>
      </div>
    </div>
  );
}
