"use client";

import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type ReportRow = {
  id: string;
  termNumber: number | null;
  donatedAt: string;
  belongsTo: string | null;
  municipality: string;
  quantity: number;
  entity: string;
  address: string;
  responsible: string;
  contact: string;
  email: string;
  equipment: string;
  totalItems: number;
  kitsCount: number;
};

type ExtraCols = {
  termNumber: boolean;
  donatedAt: boolean;
  belongsTo: boolean;
  equipment: boolean;
  totalItems: boolean;
};

const DEFAULT_TITLE = "RELAÇÃO DE BENEFICIADOS COM COMPUTADORES";

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

function formatDateBr(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function RelatorioBeneficiadosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState({ terms: 0, quantity: 0 });
  const [belongsToOptions, setBelongsToOptions] = useState<string[]>(["Todos"]);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [belongsTo, setBelongsTo] = useState("Todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [extra, setExtra] = useState<ExtraCols>({
    termNumber: false,
    donatedAt: false,
    belongsTo: false,
    equipment: false,
    totalItems: false,
  });

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (belongsTo && belongsTo !== "Todos") sp.set("belongsTo", belongsTo);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [belongsTo, from, to, q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gerencia/relatorio-beneficiados?${queryString}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse<{
        rows: ReportRow[];
        totals: { terms: number; quantity: number };
        belongsToOptions: string[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar relatório.");
        return;
      }
      setRows(json.data.rows);
      setTotals(json.data.totals);
      setBelongsToOptions(json.data.belongsToOptions);
    } catch {
      toast.push("error", "Falha ao carregar relatório.");
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const columnCount =
    7 +
    (extra.termNumber ? 1 : 0) +
    (extra.donatedAt ? 1 : 0) +
    (extra.belongsTo ? 1 : 0) +
    (extra.equipment ? 1 : 0) +
    (extra.totalItems ? 1 : 0);

  function buildExportRows() {
    return rows.map((r, index) => {
      const base: Record<string, string | number> = {
        "#": index + 1,
        MUNICÍPIO: r.municipality || "—",
        QUANTIDADE: String(r.quantity).padStart(2, "0"),
        "ENTIDADE/ASSOCIAÇÃO/CNPJ": r.entity,
        ENDEREÇO: r.address || "—",
        RESPONSÁVEL: r.responsible || "—",
        CONTATO: r.contact || "—",
        "E-MAIL": r.email || "—",
      };
      if (extra.termNumber) base["Nº TERMO"] = r.termNumber != null ? `#${r.termNumber}` : "—";
      if (extra.donatedAt) base["DATA DO TERMO"] = formatDateBr(r.donatedAt);
      if (extra.belongsTo) base["PERTENCE A"] = r.belongsTo || "—";
      if (extra.equipment) base.EQUIPAMENTOS = r.equipment || "—";
      if (extra.totalItems) base["TOTAL DE ITENS"] = r.totalItems;
      return base;
    });
  }

  function exportExcel() {
    if (rows.length === 0) {
      toast.push("error", "Não há registros para exportar.");
      return;
    }
    const data = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Beneficiados");
    const safeTitle = title.replace(/[^\w\-]+/g, "_").slice(0, 40) || "beneficiados";
    XLSX.writeFile(wb, `${safeTitle}.xlsx`);
    toast.push("success", "Excel gerado.");
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Relatório Excel"
        description="Relação de beneficiados no padrão da planilha de computadores."
        rightSlot={
          <Button onClick={exportExcel} disabled={loading || rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Exportar Excel
          </Button>
        }
      />

      <SectionCard title="Filtros" description="Monte a prévia antes de exportar." variant="elevated">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Título do relatório</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Pertence a</span>
            <select
              className={selectClass}
              value={belongsTo}
              onChange={(e) => setBelongsTo(e.target.value)}
            >
              {belongsToOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => setTitle(DEFAULT_TITLE)}>
              Usar título sugerido
            </Button>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm">Data início</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Data fim</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                className="pl-9"
                placeholder="Instituição, CNPJ, responsável, município…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Colunas extras</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ["termNumber", "Nº termo"],
                ["donatedAt", "Data do termo"],
                ["belongsTo", "Pertence a"],
                ["equipment", "Equipamentos"],
                ["totalItems", "Total de itens"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={extra[key]}
                  onChange={(e) => setExtra((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Termos no relatório"
          value={loading ? "—" : totals.terms}
          icon={FileSpreadsheet}
        />
        <StatTile
          label="Quantidade total"
          value={loading ? "—" : totals.quantity}
          icon={FileSpreadsheet}
          accent="emerald"
        />
        <StatTile
          label="Colunas"
          value={loading ? "—" : columnCount}
          icon={FileSpreadsheet}
          accent="sky"
        />
      </div>

      <SectionCard
        title="Prévia do Excel"
        description={`${title} · ${rows.length} registro(s)`}
        variant="elevated"
      >
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              {extra.termNumber ? <Th>Nº</Th> : null}
              {extra.donatedAt ? <Th>Data</Th> : null}
              <Th>Município</Th>
              <Th>Qtd</Th>
              <Th>Entidade / CNPJ</Th>
              <Th>Endereço</Th>
              <Th>Responsável</Th>
              <Th>Contato</Th>
              <Th>E-mail</Th>
              {extra.belongsTo ? <Th>Pertence a</Th> : null}
              {extra.equipment ? <Th>Equipamentos</Th> : null}
              {extra.totalItems ? <Th>Itens</Th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.id}>
                <Td>{index + 1}</Td>
                {extra.termNumber ? (
                  <Td>{r.termNumber != null ? `#${r.termNumber}` : "—"}</Td>
                ) : null}
                {extra.donatedAt ? <Td>{formatDateBr(r.donatedAt)}</Td> : null}
                <Td>{r.municipality || "—"}</Td>
                <Td>{String(r.quantity).padStart(2, "0")}</Td>
                <Td>
                  <div className="max-w-[240px] text-sm">{r.entity}</div>
                </Td>
                <Td>
                  <div className="max-w-[200px] text-xs text-[var(--text-muted)]">
                    {r.address || "—"}
                  </div>
                </Td>
                <Td>{r.responsible || "—"}</Td>
                <Td>{r.contact || "—"}</Td>
                <Td>
                  <div className="max-w-[160px] truncate text-xs">{r.email || "—"}</div>
                </Td>
                {extra.belongsTo ? <Td>{r.belongsTo || "—"}</Td> : null}
                {extra.equipment ? (
                  <Td>
                    <div className="max-w-[200px] text-xs text-[var(--text-muted)]">
                      {r.equipment || "—"}
                    </div>
                  </Td>
                ) : null}
                {extra.totalItems ? <Td>{r.totalItems}</Td> : null}
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <Td colSpan={columnCount + 1}>
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                    Nenhum termo confirmado encontrado com estes filtros.
                  </p>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </SectionCard>
    </PanelPageStack>
  );
}
