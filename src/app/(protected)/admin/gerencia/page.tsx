"use client";

import { AlertTriangle, FileText, FileWarning, ScrollText, UserCheck, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  DashboardHero,
  PanelPageStack,
  QuickActionGrid,
  SectionCard,
  StatTile,
} from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import type { EmployeeView } from "@/lib/employees";

export default function GerenciaHomePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeView[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/colaboradores", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ employees: EmployeeView[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message : "Falha ao carregar os dados.");
        return;
      }
      setEmployees(json.data.employees);
    } catch {
      toast.push("error", "Falha ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = employees.filter((e) => e.status === "ATIVO").length;
  const dismissed = employees.filter((e) => e.status === "DESLIGADO").length;
  const withPendingDocs = employees.filter(
    (e) => e.status !== "DESLIGADO" && e.missingDocuments.length > 0,
  ).length;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="IGH — Gerência"
        title="Central administrativa"
        description="Pessoas, documentos e operação do instituto em um só lugar."
        rightSlot={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Colaboradores"
          value={loading ? "—" : employees.length}
          icon={Users}
          href="/admin/gerencia/colaboradores"
        />
        <StatTile
          label="Ativos"
          value={loading ? "—" : active}
          icon={UserCheck}
          accent="emerald"
          href="/admin/gerencia/colaboradores"
        />
        <StatTile
          label="Documentos pendentes"
          value={loading ? "—" : withPendingDocs}
          icon={FileWarning}
          accent="amber"
          sublabel={withPendingDocs > 0 ? "Fichas incompletas" : "Nenhuma pendência"}
          href="/admin/gerencia/colaboradores"
        />
        <StatTile
          label="Desligados"
          value={loading ? "—" : dismissed}
          icon={AlertTriangle}
          accent="rose"
          href="/admin/gerencia/colaboradores"
        />
      </div>

      <SectionCard
        title="Atalhos"
        description="Pessoas e documentos oficiais já disponíveis nesta etapa."
        variant="elevated"
      >
        <QuickActionGrid
          items={[
            {
              href: "/admin/gerencia/colaboradores",
              label: "Colaboradores",
              description: "Fichas, documentos e vínculos",
              icon: Users,
              accent: "from-emerald-600 to-teal-500",
            },
            {
              href: "/admin/gerencia/contratos",
              label: "Contratos",
              description: "Contratação, distratos e notas",
              icon: FileText,
              accent: "from-sky-600 to-blue-500",
            },
            {
              href: "/admin/gerencia/modelos",
              label: "Modelos oficiais",
              description: "Textos editáveis com variáveis",
              icon: ScrollText,
              accent: "from-amber-600 to-orange-500",
            },
            {
              href: "/admin/gerencia/financeiro",
              label: "Financeiro",
              description: "Entradas, saídas e notas",
              icon: Wallet,
              accent: "from-violet-600 to-indigo-500",
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Próximos módulos"
        description="Seguem na fila após esta entrega."
        variant="elevated"
      >
        <ul className="grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
          <li>Termos de doação e acompanhamento das donatárias.</li>
          <li>Almoxarifado e estoque patrimonial, com alerta de estoque baixo.</li>
        </ul>
      </SectionCard>
    </PanelPageStack>
  );
}
