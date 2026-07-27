"use client";

import { useEffect, useState } from "react";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import * as XLSX from "xlsx";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  repliedAt: string | null;
};

type ExportKind = "xlsx" | "pdf";

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}

function whatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length >= 10 && !digits.startsWith("55") ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

/** Helvetica no pdf-lib usa WinAnsi e quebra com emojis/símbolos. */
function toWinAnsiSafe(input: unknown): string {
  const s = (input ?? "").toString();
  if (!s) return "";
  return s
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[•∙]/g, "-")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = toWinAnsiSafe(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

export default function MensagensContatoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/contact-messages");
      const json = (await res.json()) as ApiResponse<{ items: ContactMessage[] }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar.");
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

  async function toggleReplied(m: ContactMessage) {
    const newReplied = !m.repliedAt;
    setTogglingId(m.id);
    try {
      const res = await fetch(`/api/admin/site/contact-messages/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replied: newReplied }),
      });
      const json = (await res.json()) as ApiResponse<{ repliedAt: string | null }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok && "error" in json ? json.error.message : "Falha ao atualizar.");
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === m.id ? { ...item, repliedAt: json.data?.repliedAt ?? null } : item
        )
      );
      toast.push("success", newReplied ? "Marcada como respondida." : "Desmarcada como respondida.");
    } finally {
      setTogglingId(null);
    }
  }

  function exportExcel() {
    if (exporting || items.length === 0) return;
    setExporting("xlsx");
    try {
      const rows = items.map((m) => ({
        Data: formatDateTime(m.createdAt),
        Nome: m.name,
        "E-mail": m.email,
        Telefone: formatPhone(m.phone),
        Mensagem: m.message,
        Lida: m.readAt ? "Sim" : "Não",
        "Lida em": formatDateTime(m.readAt),
        Respondida: m.repliedAt ? "Sim" : "Não",
        "Respondida em": formatDateTime(m.repliedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 28 },
        { wch: 32 },
        { wch: 16 },
        { wch: 60 },
        { wch: 8 },
        { wch: 20 },
        { wch: 12 },
        { wch: 20 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mensagens de contato");
      XLSX.writeFile(wb, `mensagens_contato_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.push("success", "Relatório Excel exportado.");
    } catch {
      toast.push("error", "Falha ao exportar o Excel.");
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    if (exporting || items.length === 0) return;
    setExporting("pdf");
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pageSize = { width: 595.28, height: 841.89 }; // A4
      const margin = 40;
      const maxWidth = pageSize.width - margin * 2;
      const fontSize = 10;
      const titleSize = 16;
      const lineHeight = 13;

      let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
      let y = pageSize.height - margin;

      const ensureSpace = (needed: number) => {
        if (y - needed < margin) {
          page = pdfDoc.addPage([pageSize.width, pageSize.height]);
          y = pageSize.height - margin;
        }
      };

      const drawText = (text: string, size: number, bold = false) => {
        const usedFont = bold ? fontBold : font;
        for (const line of wrapLines(text, usedFont, size, maxWidth)) {
          ensureSpace(lineHeight + 2);
          page.drawText(line, { x: margin, y, size, font: usedFont });
          y -= lineHeight;
        }
      };

      drawText("Relatório de mensagens de contato", titleSize, true);
      y -= 4;
      drawText(`Gerado em ${new Date().toLocaleString("pt-BR")} — ${items.length} mensagem(ns)`, 9);
      y -= 8;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageSize.width - margin, y },
        thickness: 1,
      });
      y -= 16;

      for (let i = 0; i < items.length; i++) {
        const m = items[i]!;
        ensureSpace(lineHeight * 8);
        drawText(`${i + 1}. ${m.name}`, 11, true);
        drawText(`Data: ${formatDateTime(m.createdAt)}`, fontSize);
        drawText(`E-mail: ${m.email}`, fontSize);
        drawText(`Telefone: ${formatPhone(m.phone)}`, fontSize);
        drawText(
          `Status: ${m.readAt ? "Lida" : "Não lida"} | ${m.repliedAt ? "Respondida" : "Não respondida"}`,
          fontSize
        );
        drawText("Mensagem:", fontSize, true);
        drawText(m.message || "—", fontSize);
        y -= 8;
        if (i < items.length - 1) {
          ensureSpace(10);
          page.drawLine({
            start: { x: margin, y },
            end: { x: pageSize.width - margin, y },
            thickness: 0.5,
          });
          y -= 14;
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mensagens_contato_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push("success", "Relatório PDF exportado.");
    } catch {
      toast.push("error", "Falha ao exportar o PDF.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">Mensagens de contato</div>
          <div className="text-sm text-[var(--text-muted)]">
            Mensagens enviadas pelo formulário da página /contato. Ao abrir esta página, as mensagens são marcadas como lidas.
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={exportExcel}
            disabled={loading || exporting !== null || items.length === 0}
            className="w-full shrink-0 sm:w-auto"
          >
            {exporting === "xlsx" ? "Exportando…" : "Exportar Excel"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void exportPdf()}
            disabled={loading || exporting !== null || items.length === 0}
            className="w-full shrink-0 sm:w-auto"
          >
            {exporting === "pdf" ? "Exportando…" : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Telefone</Th>
                <Th>Mensagem</Th>
                <Th>Lida</Th>
                <Th>Respondida</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="text-center text-[var(--text-muted)]">
                    Nenhuma mensagem recebida.
                  </Td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                      {new Date(m.createdAt).toLocaleString("pt-BR")}
                    </Td>
                    <Td className="font-medium text-[var(--text-primary)]">{m.name}</Td>
                    <Td>
                      <a href={`mailto:${m.email}`} className="text-[var(--igh-primary)] hover:underline">
                        {m.email}
                      </a>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <a
                        href={whatsAppLink(m.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--igh-primary)] hover:underline"
                        title="Abrir no WhatsApp"
                      >
                        {formatPhone(m.phone)}
                      </a>
                      <span className="ml-1 text-xs text-[var(--text-muted)]" aria-hidden>↗</span>
                    </Td>
                    <Td className="max-w-md whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                      {m.message}
                    </Td>
                    <Td className="text-center">
                      {m.readAt ? (
                        <span className="text-sm text-[var(--text-muted)]" title={new Date(m.readAt).toLocaleString("pt-BR")}>
                          Sim
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">—</span>
                      )}
                    </Td>
                    <Td>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={togglingId === m.id}
                        onClick={() => toggleReplied(m)}
                      >
                        {togglingId === m.id ? "..." : m.repliedAt ? "Desmarcar" : "Marcar respondida"}
                      </Button>
                      {m.repliedAt && (
                        <span className="ml-1 text-xs text-[var(--text-muted)]" title={new Date(m.repliedAt).toLocaleString("pt-BR")}>
                          ✓
                        </span>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
