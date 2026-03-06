"use client";

import { useEffect, useState } from "react";
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

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function whatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length >= 10 && !digits.startsWith("55") ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

export default function MensagensContatoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold text-[var(--text-primary)]">Mensagens de contato</div>
        <div className="text-sm text-[var(--text-muted)]">
          Mensagens enviadas pelo formulário da página /contato. Ao abrir esta página, as mensagens são marcadas como lidas.
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
