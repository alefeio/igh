"use client";

import * as XLSX from "xlsx";
import { CheckCircle2, Plus, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { formatCentsBRL, FUNDING_CHANNEL_LABEL } from "@/lib/employees";
import type { FundingChannel } from "@/generated/prisma/client";

type PayrollLine = {
  id: string;
  employeeId: string;
  employeeName: string;
  positionLabel: string;
  employmentType: string;
  documentId: string | null;
  bankSummary: string | null;
  fundingChannel: FundingChannel;
  fundingContractRef: string | null;
  paymentAgreementName: string | null;
  amountCents: number;
  offBooksPayCents: number;
  observation: string | null;
  paymentStatus: "PENDENTE" | "PAGO";
  paidAt: string | null;
};

type Payroll = {
  id: string;
  referenceMonth: string;
  status: "ABERTA" | "FECHADA";
  responsibleName: string | null;
  notes: string | null;
  totals: {
    collaborators: number;
    withDocument: number;
    amountCents: number;
    offBooksPayCents: number;
    totalCents: number;
  };
  staffLines: PayrollLine[];
  internLines: PayrollLine[];
};

type MealTicket = {
  id: string;
  payrollMonthId: string;
  referenceMonth: string;
  totals: { total: number; confirmed: number; pending: number };
  lines: Array<{
    id: string;
    employeeName: string;
    positionLabel: string;
    status: "PENDING" | "CONFIRMED";
    notes: string | null;
  }>;
};

type TabId = "folha" | "tickets";

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default function FolhaPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("folha");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [meal, setMeal] = useState<MealTicket | null>(null);
  const [responsibleName, setResponsibleName] = useState("");

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gerencia/folha?month=${month}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ payroll: Payroll | null }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar folha.");
        return;
      }
      setPayroll(json.data.payroll);
      if (json.data.payroll?.responsibleName) setResponsibleName(json.data.payroll.responsibleName);
    } catch {
      toast.push("error", "Falha ao carregar folha.");
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  const loadTickets = useCallback(async (payrollId: string) => {
    const res = await fetch(`/api/admin/gerencia/folha/${payrollId}/tickets`, { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ mealTicket: MealTicket }>;
    if (res.ok && json.ok) setMeal(json.data.mealTicket);
    else setMeal(null);
  }, []);

  useEffect(() => {
    void loadPayroll();
  }, [loadPayroll]);

  useEffect(() => {
    if (payroll?.id && tab === "tickets") void loadTickets(payroll.id);
  }, [payroll?.id, tab, loadTickets]);

  async function openMonth() {
    setOpening(true);
    try {
      const res = await fetch("/api/admin/gerencia/folha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, responsibleName: responsibleName.trim() || null }),
      });
      const json = (await res.json()) as ApiResponse<{ payroll: Payroll }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao abrir folha.");
        return;
      }
      setPayroll(json.data.payroll);
      toast.push("success", "Folha aberta com snapshot dos colaboradores.");
    } catch {
      toast.push("error", "Falha ao abrir folha.");
    } finally {
      setOpening(false);
    }
  }

  async function setMonthStatus(status: "ABERTA" | "FECHADA") {
    if (!payroll) return;
    const res = await fetch(`/api/admin/gerencia/folha/${payroll.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = (await res.json()) as ApiResponse<{ payroll: Payroll }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar status.");
      return;
    }
    setPayroll(json.data.payroll);
    toast.push("success", status === "FECHADA" ? "Folha fechada." : "Folha reaberta.");
  }

  async function patchLine(lineId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/gerencia/folha/linhas/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResponse<{ line: PayrollLine }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar linha.");
      return;
    }
    setPayroll((prev) => {
      if (!prev) return prev;
      const mapLine = (l: PayrollLine) => (l.id === lineId ? { ...l, ...json.data.line } : l);
      const staffLines = prev.staffLines.map(mapLine);
      const internLines = prev.internLines.map(mapLine);
      const all = [...staffLines, ...internLines];
      const amountCents = all.reduce((s, l) => s + l.amountCents, 0);
      const offBooksPayCents = all.reduce((s, l) => s + l.offBooksPayCents, 0);
      return {
        ...prev,
        staffLines,
        internLines,
        totals: {
          collaborators: all.length,
          withDocument: all.filter((l) => l.documentId).length,
          amountCents,
          offBooksPayCents,
          totalCents: amountCents + offBooksPayCents,
        },
      };
    });
  }

  async function patchTicket(lineId: string, status: "PENDING" | "CONFIRMED", notes?: string) {
    if (!payroll) return;
    const res = await fetch(`/api/admin/gerencia/folha/${payroll.id}/tickets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId, status, notes: notes ?? undefined }),
    });
    const json = (await res.json()) as ApiResponse<{ mealTicket: MealTicket }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar ticket.");
      return;
    }
    setMeal(json.data.mealTicket);
  }

  function exportFolha() {
    if (!payroll) return;
    const rows = [...payroll.staffLines, ...payroll.internLines].map((l) => ({
      Nome: l.employeeName,
      Função: l.positionLabel,
      Documento: l.documentId ?? "",
      Contrato: l.fundingContractRef ?? "",
      Banco: l.bankSummary ?? "",
      Convênio: l.paymentAgreementName ?? "",
      Canal: FUNDING_CHANNEL_LABEL[l.fundingChannel],
      Valor: l.amountCents / 100,
      "Por fora": l.offBooksPayCents / 100,
      Status: l.paymentStatus === "PAGO" ? "OK" : "",
      Observação: l.observation ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folha");
    XLSX.writeFile(wb, `folha_${payroll.referenceMonth}.xlsx`);
  }

  function tabBtn(id: TabId, label: string) {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-[var(--igh-primary)] text-white"
            : "bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        {label}
      </button>
    );
  }

  function renderLines(title: string, lines: PayrollLine[]) {
    if (!lines.length) return null;
    const closed = payroll?.status === "FECHADA";
    return (
      <SectionCard title={title} description={`${lines.length} pessoa(s)`} variant="elevated">
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Função</Th>
              <Th>Documento</Th>
              <Th>Canal</Th>
              <Th>Valor</Th>
              <Th>Por fora</Th>
              <Th>Pagamento</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <Td className="font-medium">
                  <div>{l.employeeName}</div>
                  {l.fundingContractRef ? (
                    <div className="text-xs text-[var(--text-muted)]">{l.fundingContractRef}</div>
                  ) : null}
                </Td>
                <Td>{l.positionLabel}</Td>
                <Td className="whitespace-nowrap text-xs">{l.documentId ?? "—"}</Td>
                <Td>
                  <Badge tone={l.fundingChannel === "POR_FORA" ? "amber" : "blue"}>
                    {FUNDING_CHANNEL_LABEL[l.fundingChannel]}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  {closed ? (
                    formatCentsBRL(l.amountCents)
                  ) : (
                    <Input
                      className="h-8 w-24 text-xs"
                      defaultValue={centsToInput(l.amountCents)}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) void patchLine(l.id, { amount: v });
                      }}
                    />
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {closed ? (
                    formatCentsBRL(l.offBooksPayCents)
                  ) : (
                    <Input
                      className="h-8 w-24 text-xs"
                      defaultValue={centsToInput(l.offBooksPayCents)}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        void patchLine(l.id, { offBooksPay: v || "0" });
                      }}
                    />
                  )}
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant={l.paymentStatus === "PAGO" ? "secondary" : "primary"}
                    disabled={closed}
                    onClick={() =>
                      void patchLine(l.id, {
                        paymentStatus: l.paymentStatus === "PAGO" ? "PENDENTE" : "PAGO",
                      })
                    }
                  >
                    {l.paymentStatus === "PAGO" ? "Pago" : "Marcar pago"}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    );
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Pessoas"
        title="Folha de pagamento"
        description="Abra o mês, confira valores/canal e confirme pagamentos e tickets de alimentação."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            {payroll ? (
              <>
                <Button variant="secondary" onClick={exportFolha}>
                  Excel
                </Button>
                {payroll.status === "ABERTA" ? (
                  <Button variant="secondary" onClick={() => void setMonthStatus("FECHADA")}>
                    Fechar mês
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => void setMonthStatus("ABERTA")}>
                    Reabrir
                  </Button>
                )}
              </>
            ) : (
              <Button onClick={() => void openMonth()} disabled={opening || loading}>
                <Plus className="mr-1.5 h-4 w-4" />
                {opening ? "Abrindo…" : "Abrir folha do mês"}
              </Button>
            )}
          </div>
        }
      />

      <SectionCard title="Competência" variant="elevated">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Mês</span>
            <Input className="mt-1" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--text-muted)]">Responsável</span>
            <Input
              className="mt-1"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Ex.: Auriane Santos"
            />
          </label>
        </div>
      </SectionCard>

      {payroll ? (
        <>
          <div className="flex flex-wrap gap-2">
            {tabBtn("folha", "Folha")}
            {tabBtn("tickets", "Tickets alimentação")}
          </div>

          {tab === "folha" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatTile label="Colaboradores" value={String(payroll.totals.collaborators)} icon={Wallet} />
                <StatTile label="Com documento" value={String(payroll.totals.withDocument)} icon={Wallet} />
                <StatTile
                  label="Valor contratual"
                  value={formatCentsBRL(payroll.totals.amountCents)}
                  icon={Wallet}
                  accent="sky"
                />
                <StatTile
                  label="Por fora"
                  value={formatCentsBRL(payroll.totals.offBooksPayCents)}
                  icon={Wallet}
                  accent="amber"
                />
                <StatTile
                  label="Total geral"
                  value={formatCentsBRL(payroll.totals.totalCents)}
                  icon={CheckCircle2}
                  accent="emerald"
                />
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                Status:{" "}
                <Badge tone={payroll.status === "ABERTA" ? "green" : "zinc"}>{payroll.status}</Badge>
              </div>
              {renderLines("Colaboradores", payroll.staffLines)}
              {renderLines("Estagiários", payroll.internLines)}
            </>
          ) : meal ? (
            <SectionCard
              title="Tickets de alimentação"
              description={`${meal.totals.confirmed} confirmados · ${meal.totals.pending} pendentes`}
              variant="elevated"
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>Função</Th>
                    <Th>Status</Th>
                    <Th>Observações</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {meal.lines.map((l) => (
                    <tr key={l.id}>
                      <Td className="font-medium">{l.employeeName}</Td>
                      <Td>{l.positionLabel}</Td>
                      <Td>
                        <Badge tone={l.status === "CONFIRMED" ? "green" : "amber"}>
                          {l.status === "CONFIRMED" ? "Confirmado" : "Pendente"}
                        </Badge>
                      </Td>
                      <Td>
                        <Input
                          className="h-8 text-xs"
                          defaultValue={l.notes ?? ""}
                          onBlur={(e) => {
                            const notes = e.target.value.trim();
                            void patchTicket(l.id, l.status, notes || undefined);
                          }}
                        />
                      </Td>
                      <Td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void patchTicket(
                              l.id,
                              l.status === "CONFIRMED" ? "PENDING" : "CONFIRMED",
                              l.notes ?? undefined,
                            )
                          }
                        >
                          {l.status === "CONFIRMED" ? "Desfazer" : "Confirmar"}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </SectionCard>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Carregando tickets…</p>
          )}
        </>
      ) : loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <SectionCard title="Nenhuma folha neste mês" variant="elevated">
          <p className="text-sm text-[var(--text-muted)]">
            Clique em “Abrir folha do mês” para gerar as linhas a partir dos colaboradores ativos.
          </p>
        </SectionCard>
      )}
    </PanelPageStack>
  );
}
