"use client";

import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EmployeeFormModal,
  type LinkableUser,
  type PoloOption,
} from "@/components/gerencia/EmployeeFormModal";
import { EmployeeDocumentsPanel } from "@/components/gerencia/EmployeeDocumentsPanel";
import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import {
  EMPLOYEE_STATUS_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  employeePositionText,
  formatCpf,
  type EmployeeView,
} from "@/lib/employees";

type StatusFilter = "TODOS" | "ATIVO" | "DESATIVADOS";

function statusTone(status: EmployeeView["status"]): "green" | "amber" | "zinc" {
  if (status === "ATIVO") return "green";
  if (status === "AFASTADO") return "amber";
  return "zinc";
}

export default function ColaboradoresPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeView[]>([]);
  const [users, setUsers] = useState<LinkableUser[]>([]);
  const [polos, setPolos] = useState<PoloOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeView | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsEmployee, setDocsEmployee] = useState<EmployeeView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, optRes] = await Promise.all([
        fetch("/api/admin/gerencia/colaboradores", { cache: "no-store" }),
        fetch("/api/admin/gerencia/opcoes", { cache: "no-store" }),
      ]);
      const empJson = (await empRes.json()) as ApiResponse<{ employees: EmployeeView[] }>;
      const optJson = (await optRes.json()) as ApiResponse<{
        users: LinkableUser[];
        polos: PoloOption[];
      }>;
      if (!empRes.ok || !empJson.ok) {
        toast.push("error", !empJson.ok ? empJson.error.message : "Falha ao carregar colaboradores.");
        return;
      }
      setEmployees(empJson.data.employees);
      if (optRes.ok && optJson.ok) {
        setUsers(optJson.data.users);
        setPolos(optJson.data.polos);
      }
    } catch {
      toast.push("error", "Falha ao carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshOptions(includeUserId?: string | null) {
    const qs = includeUserId ? `?includeUserId=${encodeURIComponent(includeUserId)}` : "";
    const res = await fetch(`/api/admin/gerencia/opcoes${qs}`, { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ users: LinkableUser[]; polos: PoloOption[] }>;
    if (res.ok && json.ok) {
      setUsers(json.data.users);
      setPolos(json.data.polos);
    }
  }

  const counts = useMemo(() => {
    const ativos = employees.filter((e) => e.status === "ATIVO").length;
    const desativados = employees.filter((e) => e.status !== "ATIVO").length;
    return { todos: employees.length, ativos, desativados };
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = search.replace(/\D/g, "");
    return employees.filter((e) => {
      if (statusFilter === "ATIVO" && e.status !== "ATIVO") return false;
      if (statusFilter === "DESATIVADOS" && e.status === "ATIVO") return false;
      if (!q && !digits) return true;
      const hay = `${e.name} ${employeePositionText(e)} ${e.cpf} ${e.email ?? ""}`.toLowerCase();
      if (q && hay.includes(q)) return true;
      if (digits && e.cpf.includes(digits)) return true;
      return false;
    });
  }, [employees, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    void refreshOptions();
    setFormOpen(true);
  }

  function openEdit(e: EmployeeView) {
    setEditing(e);
    void refreshOptions(e.userId);
    setFormOpen(true);
  }

  function openDocs(e: EmployeeView) {
    setDocsEmployee(e);
    setDocsOpen(true);
  }

  function upsertLocal(employee: EmployeeView) {
    setEmployees((prev) => {
      const idx = prev.findIndex((x) => x.id === employee.id);
      if (idx < 0) return [employee, ...prev];
      const next = [...prev];
      next[idx] = employee;
      return next;
    });
    setDocsEmployee((cur) => (cur?.id === employee.id ? employee : cur));
  }

  async function archiveEmployee(e: EmployeeView) {
    if (!window.confirm(`Arquivar a ficha de ${e.name}?`)) return;
    try {
      const res = await fetch(`/api/admin/gerencia/colaboradores/${e.id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ archived?: boolean }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao arquivar.");
        return;
      }
      setEmployees((prev) => prev.filter((x) => x.id !== e.id));
      toast.push("success", "Colaborador arquivado.");
    } catch {
      toast.push("error", "Falha ao arquivar.");
    }
  }

  const filterBtn = (id: StatusFilter, label: string, count: number) => {
    const active = statusFilter === id;
    return (
      <button
        type="button"
        onClick={() => setStatusFilter(id)}
        className={`min-w-[7rem] rounded-xl border px-4 py-3 text-left transition ${
          active
            ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
            : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40"
        }`}
      >
        <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-white/80" : "text-[var(--text-muted)]"}`}>
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{count}</p>
      </button>
    );
  };

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Pessoas"
        title="Colaboradores"
        description="Cadastre fichas, anexe documentos e acompanhe ativos e desligados."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Novo colaborador
          </Button>
        }
      />

      <SectionCard title="Funcionários" description="Busque por nome, cargo ou CPF." variant="elevated">
        <div className="mb-4 flex flex-wrap gap-2">
          {filterBtn("TODOS", "Todos", counts.todos)}
          {filterBtn("ATIVO", "Ativos", counts.ativos)}
          {filterBtn("DESATIVADOS", "Desativados", counts.desativados)}
        </div>

        <div className="relative mb-4 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Buscar nome, cargo ou CPF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando colaboradores…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--card-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            Nenhum colaborador encontrado.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>CPF</Th>
                <Th>Cargo</Th>
                <Th>Vínculo</Th>
                <Th>Status</Th>
                <Th>Docs</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <div className="font-medium">{e.name}</div>
                    {e.user ? (
                      <div className="text-xs text-[var(--text-muted)]">{e.user.email}</div>
                    ) : (
                      <div className="text-xs text-[var(--text-muted)]">Sem conta no sistema</div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{formatCpf(e.cpf)}</Td>
                  <Td>{employeePositionText(e)}</Td>
                  <Td>{EMPLOYMENT_TYPE_LABEL[e.employmentType]}</Td>
                  <Td>
                    <Badge tone={statusTone(e.status)}>{EMPLOYEE_STATUS_LABEL[e.status]}</Badge>
                  </Td>
                  <Td>
                    {e.missingDocuments.length > 0 ? (
                      <Badge tone="amber">{e.missingDocuments.length} pendente(s)</Badge>
                    ) : (
                      <Badge tone="green">Completo</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(e)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openDocs(e)}>
                        Documentos
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void archiveEmployee(e)}>
                        Arquivar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <EmployeeFormModal
        open={formOpen}
        editing={editing}
        users={users}
        polos={polos}
        onClose={() => setFormOpen(false)}
        onSaved={(employee) => {
          upsertLocal(employee);
          void refreshOptions();
        }}
      />

      <Modal
        open={docsOpen && !!docsEmployee}
        onClose={() => setDocsOpen(false)}
        title={docsEmployee ? `Documentos — ${docsEmployee.name}` : "Documentos"}
        size="large"
      >
        {docsEmployee ? (
          <EmployeeDocumentsPanel employee={docsEmployee} onUpdated={upsertLocal} />
        ) : null}
      </Modal>
    </PanelPageStack>
  );
}
