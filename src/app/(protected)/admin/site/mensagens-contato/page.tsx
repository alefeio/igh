"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
};

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function MensagensContatoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContactMessage[]>([]);

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold text-[var(--text-primary)]">Mensagens de contato</div>
        <div className="text-sm text-[var(--text-muted)]">
          Mensagens enviadas pelo formulário da página /contato.
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
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
              <tr>
                <Td colSpan={5} className="text-center text-[var(--text-muted)]">
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
                  <Td className="whitespace-nowrap">{formatPhone(m.phone)}</Td>
                  <Td className="max-w-md whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                    {m.message}
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
