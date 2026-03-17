"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalFound: number;
  totalValid: number;
  totalSent: number;
  totalFailed: number;
  totalDelivered: number;
  scheduledAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  PROCESSING: "Enviando",
  SENT: "Enviada",
  PARTIALLY_SENT: "Parcial",
  FAILED: "Falha",
  CANCELED: "Cancelada",
};

export default function EmailCampaignsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/email/campaigns?${params}`);
      const json = (await res.json()) as ApiResponse<{
        items: Campaign[];
        total: number;
        page: number;
        pageSize: number;
      }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? json.error?.message ?? "Falha ao carregar." : "Falha ao carregar."
        );
        return;
      }
      setItems(json.data.items);
      setTotal(json.data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, statusFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Campanhas de E-mail
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/email/templates">
            <Button variant="secondary">Templates</Button>
          </Link>
          <Link href="/admin/email/nova">
            <Button>Nova campanha</Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px]"
          />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)]">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhuma campanha encontrada.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-[var(--border)]">
            <Table>
              <thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Status</Th>
                  <Th>Totais</Th>
                  <Th>Agendamento</Th>
                  <Th>Criada em</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link
                        href={`/admin/email/${c.id}`}
                        className="font-medium text-[var(--igh-primary)] hover:underline"
                      >
                        {c.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          c.status === "SENT"
                            ? "green"
                            : c.status === "FAILED" || c.status === "CANCELED"
                              ? "red"
                              : "zinc"
                        }
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="text-sm">
                        {c.totalValid} elegíveis · {c.totalSent} enviados
                        {c.totalDelivered > 0 && ` · ${c.totalDelivered} entregues`}
                        {c.totalFailed > 0 && ` · ${c.totalFailed} falhas`}
                      </span>
                    </Td>
                    <Td>
                      {c.scheduledAt
                        ? new Date(c.scheduledAt).toLocaleString("pt-BR")
                        : "—"}
                    </Td>
                    <Td>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</Td>
                    <Td>
                      <Link href={`/admin/email/${c.id}`}>
                        <Button variant="secondary" size="sm">
                          Ver
                        </Button>
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-[var(--text-muted)]">
                Página {page} de {totalPages} ({total} itens)
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
