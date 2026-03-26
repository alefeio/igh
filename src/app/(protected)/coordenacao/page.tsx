"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type ReportRow = {
  id: string;
  protocolNumber: string;
  subject: string;
  summary: string;
  status: string;
  unreadByCoordinator?: boolean;
  unreadByReporter?: boolean;
  createdAt: string;
  updatedAt: string;
  fromUser?: { id: string; name: string; email: string };
  lastMessagePreview?: string | null;
};

export default function CoordenacaoPage() {
  const user = useUser();
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  const isCoordinator = user.role === "COORDINATOR";
  const canCreate = user.role === "TEACHER" || user.role === "ADMIN" || user.role === "MASTER";

  useEffect(() => {
    if (user.role === "STUDENT") {
      router.replace("/dashboard");
    }
  }, [user.role, router]);

  useEffect(() => {
    if (user.role === "STUDENT") return;
    setLoading(true);
    fetch("/api/coordinator-reports", { credentials: "include" })
      .then((r) => r.json() as Promise<ApiResponse<{ reports: ReportRow[] }>>)
      .then((json) => {
        if (json?.ok && json.data?.reports) setReports(json.data.reports);
      })
      .finally(() => setLoading(false));
  }, [user.role]);

  const statusLabel: Record<string, string> = {
    OPEN: "Aberto",
    ANSWERED: "Respondido",
    CLOSED: "Encerrado",
  };

  const visible = reports.filter((r) => (showClosed ? true : r.status !== "CLOSED"));

  const unread = (r: ReportRow) =>
    isCoordinator ? r.unreadByCoordinator : r.unreadByReporter;

  if (user.role === "STUDENT") {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Comunicação"
        title={isCoordinator ? "Reportes recebidos" : "Coordenação"}
        description={
          isCoordinator
            ? "Mensagens e comunicados enviados por professores e administradores. Responda pela conversa abaixo."
            : "Envie notícias ou informações relevantes diretamente à coordenação. Você pode anexar arquivos."
        }
        rightSlot={
          canCreate ? (
            <Button type="button" onClick={() => router.push("/coordenacao/novo")} className="w-full sm:w-auto">
              Novo reporte
            </Button>
          ) : undefined
        }
      />

      <SectionCard
        title="Lista"
        description={
          loading
            ? "Carregando…"
            : `${visible.length} ${visible.length === 1 ? "reporte" : "reportes"}${showClosed ? "" : " (sem encerrados)"}.`
        }
        variant="elevated"
      >
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Ocultar encerrados" : "Exibir encerrados"}
          </Button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            {isCoordinator ? "Nenhum reporte ainda." : "Você ainda não enviou reportes."}
          </p>
        ) : (
          <ul className="flex list-none flex-col gap-2 pl-0">
            {visible.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/coordenacao/${r.id}`}
                  className="block rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-[var(--igh-primary)]/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {unread(r) && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--igh-primary)]" aria-hidden />
                        )}
                        <span className="font-mono text-xs text-[var(--text-muted)]">{r.protocolNumber}</span>
                        <Badge tone={r.status === "CLOSED" ? "zinc" : r.status === "ANSWERED" ? "green" : "blue"}>
                          {statusLabel[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">{r.subject}</p>
                      {isCoordinator && r.fromUser && (
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">De: {r.fromUser.name}</p>
                      )}
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{r.summary}</p>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">
                      {new Date(r.updatedAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
