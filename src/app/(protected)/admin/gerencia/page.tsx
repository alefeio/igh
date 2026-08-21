"use client";

import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Columns3,
  Cpu,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Gift,
  Inbox,
  Package,
  ScrollText,
  Settings2,
  Target,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  DashboardHero,
  PanelPageStack,
  QuickActionGrid,
  SectionCard,
  StatTile,
} from "@/components/dashboard/DashboardUI";
import { GerenciaReadOnlyBanner } from "@/components/gerencia/GerenciaReadOnlyBanner";
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
      <GerenciaReadOnlyBanner />
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
        description="Pessoas, documentos, estoque, doações e financeiro."
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
              href: "/admin/gerencia/portal",
              label: "Fila do portal",
              description: "Notas, mensagens, limpeza e motorista",
              icon: Inbox,
              accent: "from-indigo-600 to-violet-500",
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
            {
              href: "/admin/gerencia/folha",
              label: "Folha de pagamento",
              description: "Competência, pagamentos e tickets",
              icon: Wallet,
              accent: "from-teal-700 to-emerald-600",
            },
            {
              href: "/admin/gerencia/metas",
              label: "Metas anuais",
              description: "Computadores e formação",
              icon: Target,
              accent: "from-orange-600 to-amber-500",
            },
            {
              href: "/admin/gerencia/convenios",
              label: "Convênios",
              description: "Quadro de pagamento",
              icon: Columns3,
              accent: "from-blue-700 to-indigo-600",
            },
            {
              href: "/admin/gerencia/almoxarifado",
              label: "Almoxarifado",
              description: "Estoque e movimentos",
              icon: Package,
              accent: "from-cyan-600 to-teal-500",
            },
            {
              href: "/admin/gerencia/equipamentos",
              label: "Equipamentos",
              description: "Catálogo do kit de doação",
              icon: Cpu,
              accent: "from-slate-600 to-zinc-500",
            },
            {
              href: "/admin/gerencia/donatarias",
              label: "Donatárias",
              description: "Quem recebe doações",
              icon: Building2,
              accent: "from-rose-600 to-pink-500",
            },
            {
              href: "/admin/gerencia/doacoes",
              label: "Doações",
              description: "Bens, dinheiro e termos",
              icon: Gift,
              accent: "from-fuchsia-600 to-purple-500",
            },
            {
              href: "/admin/gerencia/visitas",
              label: "Visitas técnicas",
              description: "Checklist de implantação",
              icon: ClipboardCheck,
              accent: "from-lime-600 to-green-500",
            },
            {
              href: "/admin/gerencia/relatorio-beneficiados",
              label: "Beneficiados (Excel)",
              description: "Relação de quem recebeu computadores",
              icon: FileSpreadsheet,
              accent: "from-green-700 to-emerald-600",
            },
            {
              href: "/admin/gerencia/configuracoes-doadora",
              label: "Config. da doadora",
              description: "Dados do instituto no termo",
              icon: Settings2,
              accent: "from-neutral-600 to-stone-500",
            },
          ]}
        />
      </SectionCard>
    </PanelPageStack>
  );
}
