"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type NextCycleInterestItem = {
  id: string;
  name: string;
  phone: string;
  email: string;
  courseIds: string[];
  courseNames: string[];
  customCourseName: string | null;
  source: string | null;
  createdAt: string;
};

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function whatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length >= 10 && !digits.startsWith("55") ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function AdminPreInscricoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NextCycleInterestItem[]>([]);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/next-cycle-interests");
      const json = (await res.json()) as ApiResponse<{ items: NextCycleInterestItem[] }>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar.",
        );
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    if (!q) return items;
    return items.filter((item) => {
      const haystack = normalizeSearch(
        [
          item.name,
          item.email,
          item.phone,
          formatPhone(item.phone),
          item.courseNames.join(" "),
          item.customCourseName ?? "",
          item.source ?? "",
        ].join(" "),
      );
      return haystack.includes(q);
    });
  }, [items, query]);

  function exportExcel() {
    if (exporting || filtered.length === 0) return;
    setExporting(true);
    try {
      const rows = filtered.map((item) => ({
        Data: formatDateTime(item.createdAt),
        Nome: item.name,
        "E-mail": item.email,
        Telefone: formatPhone(item.phone),
        Cursos: item.courseNames.join("; "),
        Origem: item.source ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 28 },
        { wch: 32 },
        { wch: 16 },
        { wch: 50 },
        { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pré-inscrições");
      XLSX.writeFile(wb, `pre_inscricoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.push("success", "Relatório Excel exportado.");
    } catch {
      toast.push("error", "Falha ao exportar o Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">
            Pré-inscrições — próximo ciclo
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            Interessados cadastrados pelo formulário público /pre-inscricao. Inclui nome, contato e
            cursos pretendidos.
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={exportExcel}
          disabled={loading || exporting || filtered.length === 0}
          className="w-full shrink-0 sm:w-auto"
        >
          {exporting ? "Exportando…" : "Exportar Excel"}
        </Button>
      </div>

      <div className="max-w-md">
        <label htmlFor="pre-inscricoes-search" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Buscar
        </label>
        <Input
          id="pre-inscricoes-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, e-mail, telefone ou curso..."
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            {filtered.length === items.length
              ? `${items.length} pré-inscrição(ões)`
              : `${filtered.length} de ${items.length} pré-inscrição(ões)`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Telefone</Th>
                  <Th>Cursos</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <Td colSpan={5} className="text-center text-[var(--text-muted)]">
                      {items.length === 0
                        ? "Nenhuma pré-inscrição recebida."
                        : "Nenhum resultado para a busca."}
                    </Td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                        {formatDateTime(item.createdAt)}
                      </Td>
                      <Td className="font-medium text-[var(--text-primary)]">{item.name}</Td>
                      <Td>
                        <a
                          href={`mailto:${item.email}`}
                          className="text-[var(--igh-primary)] hover:underline"
                        >
                          {item.email}
                        </a>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <a
                          href={whatsAppLink(item.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--igh-primary)] hover:underline"
                          title="Abrir no WhatsApp"
                        >
                          {formatPhone(item.phone)}
                        </a>
                      </Td>
                      <Td className="max-w-md text-sm text-[var(--text-secondary)]">
                        {item.courseNames.length > 0 ? (
                          <ul className="list-disc space-y-0.5 pl-4">
                            {item.courseNames.map((name) => (
                              <li key={`${item.id}-${name}`}>{name}</li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
