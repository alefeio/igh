"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

type AccessRow = {
  id: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  loginKind: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
};

type PageVisitRow = {
  id: string;
  path: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
};

type UserOption = { id: string; name: string; email: string };

function roleLabel(role: string): string {
  const m: Record<string, string> = {
    MASTER: "Master",
    ADMIN: "Admin",
    COORDINATOR: "Coordenador",
    TEACHER: "Professor",
    STUDENT: "Aluno",
  };
  return m[role] ?? role;
}

const PAGE_SIZE = 50;

export default function MasterAccessLogsPage() {
  const toast = useToast();
  const sessionUser = useUser();
  const isMasterSession = sessionUser.role === "MASTER";

  const [tab, setTab] = useState<"logins" | "pages">("logins");

  const [loadingLogins, setLoadingLogins] = useState(true);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginPage, setLoginPage] = useState(1);
  const [loginItems, setLoginItems] = useState<AccessRow[]>([]);

  const [loadingPages, setLoadingPages] = useState(true);
  const [pageTotal, setPageTotal] = useState(0);
  const [visitPage, setVisitPage] = useState(1);
  const [visitItems, setVisitItems] = useState<PageVisitRow[]>([]);
  const [usersWithActivity, setUsersWithActivity] = useState<UserOption[]>([]);
  const [filterUserId, setFilterUserId] = useState("");

  const loadLogins = useCallback(async () => {
    if (!isMasterSession) return;
    setLoadingLogins(true);
    try {
      const res = await fetch(
        `/api/master/access-logs?page=${loginPage}&pageSize=${PAGE_SIZE}`,
        { credentials: "include", cache: "no-store" }
      );
      const json = (await res.json()) as ApiResponse<{
        total: number;
        items: AccessRow[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível carregar os logins.");
        return;
      }
      setLoginTotal(json.data.total);
      setLoginItems(json.data.items);
    } finally {
      setLoadingLogins(false);
    }
  }, [isMasterSession, loginPage, toast]);

  const loadPageVisits = useCallback(async () => {
    if (!isMasterSession) return;
    setLoadingPages(true);
    try {
      const q = new URLSearchParams({
        page: String(visitPage),
        pageSize: String(PAGE_SIZE),
      });
      if (filterUserId) q.set("userId", filterUserId);
      const res = await fetch(`/api/master/page-visits?${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse<{
        total: number;
        items: PageVisitRow[];
        usersWithActivity: UserOption[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível carregar as páginas.");
        return;
      }
      setPageTotal(json.data.total);
      setVisitItems(json.data.items);
      setUsersWithActivity(json.data.usersWithActivity);
    } finally {
      setLoadingPages(false);
    }
  }, [isMasterSession, visitPage, filterUserId, toast]);

  useEffect(() => {
    if (tab === "logins") void loadLogins();
  }, [tab, loadLogins]);

  useEffect(() => {
    if (tab === "pages") void loadPageVisits();
  }, [tab, loadPageVisits]);

  if (!isMasterSession) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <DashboardHero
          eyebrow="Master"
          title="Acessos ao sistema"
          description="Esta página só está disponível com o perfil Master selecionado no menu do usuário."
        />
        <SectionCard title="Acesso restrito" variant="elevated">
          <p className="text-sm text-[var(--text-secondary)]">
            Troque para o perfil <strong>Administrador Master</strong> e volte aqui, ou use o{" "}
            <Link href="/dashboard" className="text-[var(--igh-primary)] underline">
              dashboard
            </Link>
            .
          </p>
        </SectionCard>
      </div>
    );
  }

  const loginTotalPages = Math.max(1, Math.ceil(loginTotal / PAGE_SIZE));
  const visitTotalPages = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Master"
        title="Acessos ao sistema"
        description="Últimos logins na plataforma e páginas abertas na área logada (rotas internas), por utilizador. Dados de página começam a partir da versão que regista visitas."
      />

      <div className="flex flex-wrap gap-2 border-b border-[var(--card-border)] pb-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "logins"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--igh-surface)] text-[var(--text-primary)] hover:bg-[var(--card-border)]/40"
          }`}
          onClick={() => setTab("logins")}
        >
          Últimos logins
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "pages"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--igh-surface)] text-[var(--text-primary)] hover:bg-[var(--card-border)]/40"
          }`}
          onClick={() => setTab("pages")}
        >
          Páginas acessadas
        </button>
      </div>

      {tab === "logins" && (
        <SectionCard
          title="Histórico de logins"
          description={`Total: ${loginTotal} registro(s). Cada linha é um login bem-sucedido (e-mail ou CPF).`}
          variant="elevated"
        >
          {loadingLogins ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : loginItems.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum login registado ainda.</p>
          ) : (
            <>
              <TableShell className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <Th>Data/hora (UTC)</Th>
                    <Th>Usuário</Th>
                    <Th>Papel (conta)</Th>
                    <Th>Login</Th>
                    <Th>IP</Th>
                    <Th>Navegador</Th>
                  </tr>
                </thead>
                <tbody>
                  {loginItems.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--card-border)]/80">
                      <Td className="whitespace-nowrap">{formatDateTime(row.createdAt)}</Td>
                      <Td>
                        <span className="font-medium text-[var(--text-primary)]">{row.user.name}</span>
                        <br />
                        <span className="text-xs text-[var(--text-muted)]">{row.user.email}</span>
                        {!row.user.isActive && (
                          <span className="ml-1 text-xs text-amber-600">(inativo)</span>
                        )}
                      </Td>
                      <Td>{roleLabel(row.user.role)}</Td>
                      <Td>{row.loginKind === "CPF" ? "CPF" : "E-mail"}</Td>
                      <Td className="max-w-[140px] truncate font-mono text-xs" title={row.ipAddress ?? ""}>
                        {row.ipAddress ?? "—"}
                      </Td>
                      <Td
                        className="max-w-[280px] truncate text-xs text-[var(--text-secondary)]"
                        title={row.userAgent ?? ""}
                      >
                        {row.userAgent ?? "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              {loginTotalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Página {loginPage} de {loginTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loginPage <= 1}
                      onClick={() => setLoginPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loginPage >= loginTotalPages}
                      onClick={() => setLoginPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {tab === "pages" && (
        <SectionCard
          title="Páginas abertas na área logada"
          description="Cada linha é uma navegação (rota interna, sem parâmetros na URL). Use o filtro para ver só um utilizador."
          variant="elevated"
        >
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Filtrar por utilizador</span>
              <select
                className="min-w-[240px] rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
                value={filterUserId}
                onChange={(e) => {
                  setFilterUserId(e.target.value);
                  setVisitPage(1);
                }}
              >
                <option value="">Todos com atividade registada</option>
                {usersWithActivity.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadingPages ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : visitItems.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhuma página registada ainda. Os utilizadores passam a gerar histórico ao navegar após esta funcionalidade
              estar ativa.
            </p>
          ) : (
            <>
              <TableShell className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <Th>Data/hora (UTC)</Th>
                    <Th>Usuário</Th>
                    <Th>Papel</Th>
                    <Th>Rota (página)</Th>
                  </tr>
                </thead>
                <tbody>
                  {visitItems.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--card-border)]/80">
                      <Td className="whitespace-nowrap">{formatDateTime(row.createdAt)}</Td>
                      <Td>
                        <span className="font-medium text-[var(--text-primary)]">{row.user.name}</span>
                        <br />
                        <span className="text-xs text-[var(--text-muted)]">{row.user.email}</span>
                      </Td>
                      <Td>{roleLabel(row.user.role)}</Td>
                      <Td className="max-w-[min(100vw-4rem,480px)] break-all font-mono text-xs">
                        {row.path}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              {visitTotalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Página {visitPage} de {visitTotalPages} · {pageTotal} registro(s)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={visitPage <= 1}
                      onClick={() => setVisitPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={visitPage >= visitTotalPages}
                      onClick={() => setVisitPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
}
